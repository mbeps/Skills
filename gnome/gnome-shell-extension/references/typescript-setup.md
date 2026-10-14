# TypeScript Setup & Build Pipeline (GNOME 45+)

GNOME Shell executes standard ECMAScript Modules via GJS, but developing extensions in TypeScript delivers full compile-time static type checking, instant API autocompletion across hundreds of GObject Introspection libraries, and safe refactoring.

---

## 1. Project Directory Layout

```text
my-ts-extension/
├── package.json
├── tsconfig.json
├── ambient.d.ts
├── build.js
├── metadata.json
├── stylesheet.css
├── resources.gresource.xml (optional asset bundle)
├── po/                     (optional gettext translation sources)
├── schemas/
│   └── org.gnome.shell.extensions.my-ts-extension.gschema.xml
└── src/
    ├── extension.ts
    ├── prefs.ts
    ├── components/
    └── utils/
```

The build script compiles TypeScript from `src/` to ESM JavaScript in `dist/`, compiles schemas, gettext catalogs, and `.gresource` containers, outputting an unpackaged extension directory that can be loaded directly or zipped with `gnome-extensions pack`.

---

## 2. Dependencies (`package.json`)

Install TypeScript, `esbuild`, and the official `@girs` TypeScript type definitions:

```json
{
  "name": "my-gnome-extension-ts",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "node build.js",
    "watch": "node build.js --watch",
    "typecheck": "tsc --noEmit",
    "lint": "shexli dist",
    "pack": "npm run build && gnome-extensions pack dist --force --out-dir=./build"
  },
  "devDependencies": {
    "@girs/adw-1": "^5.5.0",
    "@girs/gjs": "^5.5.0",
    "@girs/gnome-shell": "^50.0.0",
    "@girs/gtk-4.0": "^5.5.0",
    "@types/node": "^22.0.0",
    "esbuild": "^0.25.0",
    "typescript": "^5.8.0"
  }
}
```

> **CRITICAL: `"type": "module"` in `package.json`:**
> TypeScript with `verbatimModuleSyntax: true` strictly requires `"type": "module"` in the root `package.json`. If omitted, TypeScript defaults to CommonJS mode and throws `TS1295: ECMAScript imports and exports cannot be written in a CommonJS file` and `TS1287: top-level export modifier cannot be used`.
>
> **Note on `@girs` Version Matrix:**
> - `@girs/gnome-shell`: Match your target GNOME Shell release (`^46.0.0`, `^47.0.0`, `^48.0.0`, `^49.0.0`, or `^50.0.0`).
> - Mutter & Mtk: `@girs/gnome-shell` automatically installs the matching Mutter and Mtk typings transitively:
>   - GNOME 45 -> Mutter 13 (`@girs/meta-13`, `@girs/mtk-13`)
>   - GNOME 46 -> Mutter 14 (`@girs/meta-14`, `@girs/mtk-14`)
>   - GNOME 47 -> Mutter 15 (`@girs/meta-15`, `@girs/mtk-15`)
>   - GNOME 48 -> Mutter 16 (`@girs/meta-16`, `@girs/mtk-16`)
>   - GNOME 49 -> Mutter 17 (`@girs/meta-17`, `@girs/mtk-17`)
>   - GNOME 50 -> Mutter 18 (`@girs/meta-18`, `@girs/mtk-18`)
> - Generator-based libraries (`@girs/gjs`, `@girs/gtk-4.0`, `@girs/adw-1`): Follow the generator versioning (e.g. `^5.5.0`).
```

---

## 3. TypeScript Configuration (`tsconfig.json`)

Configure TypeScript to target modern ES2023 with strict type checking and NodeNext module resolution:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "strict": true,
    "skipLibCheck": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "outDir": "./dist"
  },
  "include": [
    "ambient.d.ts",
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

---

## 4. Ambient Type Declarations (`ambient.d.ts`)

Create `ambient.d.ts` at the root of the project to inform the TypeScript compiler of GJS global symbols, `gi://` URI imports, and GNOME Shell internal `resource:///` schemes:

```typescript
import '@girs/gjs';
import '@girs/gjs/dom';
import '@girs/gnome-shell/ambient';
import '@girs/gnome-shell/extensions/extension/ambient';
import '@girs/gnome-shell/extensions/prefs/ambient';
import '@girs/gnome-shell/extensions/global';

// Custom ambient declarations if needed:
declare module 'resource:///org/gnome/shell/misc/config.js' {
    export const PACKAGE_VERSION: string;
}
```

---

## 5. Complete Production Build Pipeline (`build.js`)

This `build.js` script compiles TypeScript via `esbuild`, compiles GSettings schemas, compiles `.po` gettext translation catalogs, compiles `.gresource` bundles, and synchronizes static assets:

```javascript
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const isWatch = process.argv.includes('--watch');
const distDir = path.resolve('dist');

function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function compileTranslations(metadata) {
    const poDir = path.resolve('po');
    const domain = metadata['gettext-domain'] || metadata.uuid;
    if (fs.existsSync(poDir)) {
        for (const file of fs.readdirSync(poDir)) {
            if (file.endsWith('.po')) {
                const locale = path.basename(file, '.po');
                const targetDir = path.join(distDir, 'locale', locale, 'LC_MESSAGES');
                fs.mkdirSync(targetDir, { recursive: true });
                const poPath = path.join(poDir, file);
                const moPath = path.join(targetDir, `${domain}.mo`);
                try {
                    execSync(`msgfmt -cv -o "${moPath}" "${poPath}"`);
                } catch (e) {
                    console.error(`Failed to compile translation for ${locale}:`, e.message);
                }
            }
        }
        console.log('✓ Compiled gettext translations');
    } else if (fs.existsSync('locale')) {
        copyRecursive('locale', path.join(distDir, 'locale'));
    }
}

function compileGResources() {
    const gresourceXml = path.resolve('resources.gresource.xml');
    if (fs.existsSync(gresourceXml)) {
        const targetGResource = path.join(distDir, 'resources.gresource');
        try {
            execSync(`glib-compile-resources --target="${targetGResource}" "${gresourceXml}"`);
            console.log('✓ Compiled resources.gresource');
        } catch (e) {
            console.error('Failed to compile GResource bundle:', e.message);
        }
    }
}

function copyStaticAssets() {
    fs.mkdirSync(distDir, { recursive: true });

    // Copy metadata.json
    fs.copyFileSync('metadata.json', path.join(distDir, 'metadata.json'));
    const metadata = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));

    // Copy stylesheet if present
    if (fs.existsSync('stylesheet.css')) {
        fs.copyFileSync('stylesheet.css', path.join(distDir, 'stylesheet.css'));
    }

    // Copy preferences stylesheet if present
    if (fs.existsSync('prefs.css')) {
        fs.copyFileSync('prefs.css', path.join(distDir, 'prefs.css'));
    }

    // Copy icons and UI folders
    copyRecursive('icons', path.join(distDir, 'icons'));
    copyRecursive('ui', path.join(distDir, 'ui'));

    // Compile translations & gresources
    compileTranslations(metadata);
    compileGResources();

    // Copy and compile GSettings schemas
    const schemasSrc = path.resolve('schemas');
    const schemasDest = path.join(distDir, 'schemas');
    if (fs.existsSync(schemasSrc)) {
        fs.mkdirSync(schemasDest, { recursive: true });
        for (const file of fs.readdirSync(schemasSrc)) {
            if (file.endsWith('.gschema.xml')) {
                fs.copyFileSync(path.join(schemasSrc, file), path.join(schemasDest, file));
            }
        }
        try {
            execSync(`glib-compile-schemas "${schemasDest}"`);
            console.log('✓ Compiled GSettings schemas');
        } catch (e) {
            console.error('Failed to compile schemas:', e.message);
        }
    }
}

const entryPoints = {};
if (fs.existsSync('src/extension.ts')) entryPoints.extension = 'src/extension.ts';
if (fs.existsSync('src/prefs.ts')) entryPoints.prefs = 'src/prefs.ts';

const buildOptions = {
    entryPoints,
    bundle: true,
    outdir: 'dist',
    format: 'esm',
    target: 'es2023',
    platform: 'neutral',
    sourcemap: false,
    minify: false, // Minification is strictly prohibited by extensions.gnome.org review rules
    external: [
        'gi://*',
        'resource://*',
    ],
};

copyStaticAssets();

if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('⚡ Watching for changes...');
} else {
    await esbuild.build(buildOptions);
    console.log('✓ Extension build completed in dist/');
}
```

---

## 6. TypeScript Source Code Implementation

### `src/extension.ts` (Typed Panel Indicator)

```typescript
import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

const MyIndicator = GObject.registerClass(
    {
        GTypeName: 'MyTsIndicator',
    },
    class MyIndicator extends PanelMenu.Button {
        // GObject subclass constructor override
        override _init(_params?: any, ..._args: any[]): void {
            super._init(0.5, _('TypeScript Indicator'), false);

            const icon = new St.Icon({
                icon_name: 'application-x-addon-symbolic',
                style_class: 'system-status-icon',
            });
            this.add_child(icon);
        }
    }
);

export default class MyTsExtension extends Extension {
    private _settings: Gio.Settings | null = null;
    private _indicator: InstanceType<typeof MyIndicator> | null = null;

    override enable(): void {
        this.initTranslations();
        this._settings = this.getSettings();
        this._indicator = new MyIndicator();

        Main.panel.addToStatusArea(this.uuid, this._indicator, 1, 'right');
        console.log(`[${this.metadata.name}] TS Extension Enabled`);
    }

    override disable(): void {
        if (this._settings) {
            this._settings.disconnectObject(this);
            this._settings = null;
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        console.log(`[${this.metadata.name}] TS Extension Disabled`);
    }
}
```

### `src/prefs.ts` (Typed Libadwaita Preferences)

```typescript
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MyTsPreferences extends ExtensionPreferences {
    override async fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        this.initTranslations();
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: _('Settings'),
        });
        page.add(group);

        const row = new Adw.SwitchRow({
            title: _('Feature Active'),
        });
        settings.bind('feature-active', row, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
    }
}
```

---

## 7. GObject Subclassing Conventions in TypeScript

1. **Use `_init()` not `constructor`:** Native GObjects are initialized in GJS through `_init()`. Always invoke `super._init(...)`.
2. **Assign Unique `GTypeName`:** Always specify `GTypeName: 'UniquePrefixClassName'` in `GObject.registerClass` to avoid collisions in the GType system.
3. **Handle `override _init` Signature:** Use `override _init(_params?: any, ..._args: any[]): void` to accommodate overloaded base GObject signatures while maintaining `noImplicitOverride` and `noUnusedParameters` compliance.
4. **Typed Properties & Signals:**

```typescript
const CustomWidget = GObject.registerClass(
    {
        GTypeName: 'MyTsCustomWidget',
        Properties: {
            'status-text': GObject.ParamSpec.string(
                'status-text',
                'Status Text',
                'Displayed text status',
                GObject.ParamFlags.READWRITE,
                'Ready'
            ),
        },
        Signals: {
            'status-changed': { param_types: [GObject.TYPE_STRING] },
        },
    },
    class CustomWidget extends St.Widget {
        private _statusText: string = 'Ready';

        get status_text(): string {
            return this._statusText;
        }

        set status_text(value: string) {
            if (this._statusText !== value) {
                this._statusText = value;
                this.notify('status-text');
                this.emit('status-changed', value);
            }
        }
    }
);
```
