# Security, Secret Filtering, and Privacy in GNOME Clipboard Extensions

## Overview

Clipboard managers handle sensitive user data. Unchecked capture risks exposing master passwords, API keys, two-factor authentication codes, and financial information to disk storage or unencrypted logs.

A production GNOME clipboard extension must implement three layers of defense:
1. **MIME-Type Hints:** Detecting standard protocol flags set by password managers (e.g. `x-kde-passwordManagerHint`).
2. **Window / Application Exclusions:** Blocking capture from known password managers, virtual machines, and terminal windows.
3. **In-Browser Extension Detection via AT-SPI:** Inspecting the accessibility tree to detect password manager extension popups inside web browsers (e.g. Bitwarden, 1Password, KeePassXC-Browser).

---

## 1. Secret MIME-Type Hints (`x-kde-passwordManagerHint`)

Modern password managers (KeePassXC, 1Password, Bitwarden, Enpass) tag clipboard entries with standard MIME hints when copying credentials.

When `owner-changed` fires, inspect the advertised MIME types before reading any payload:

```javascript
import Meta from 'gi://Meta';

const SECRET_MIME_HINTS = [
    'x-kde-passwordManagerHint',
    'application/x-keepassxc-selection',
    'application/x-password-store',
];

/**
 * Checks whether the current selection contains sensitive/secret flags.
 *
 * @param {Meta.Selection} selection
 * @returns {boolean} True if content is flagged as a secret.
 */
export function isClipboardContentSecret(selection) {
    try {
        const mimeTypes = selection.get_mimetypes(Meta.SelectionType.SELECTION_CLIPBOARD) || [];
        return mimeTypes.some((mime) => {
            const lower = mime.toLowerCase();
            return SECRET_MIME_HINTS.includes(mime) || 
                   lower.includes('secret') || 
                   lower.includes('password');
        });
    } catch {
        return false;
    }
}
```

---

## 2. Window and Application Exclusions

If a user copies text within KeePassXC, Bitwarden desktop, or a terminal running `gpg` or `pass`, the capture should be aborted based on window metadata.

```javascript
import Shell from 'gi://Shell';

const DEFAULT_EXCLUDED_APPS = [
    'keepassxc',
    '1password',
    'bitwarden',
    'enpass',
    'org.keepassxc.keepassxc',
    'com.bitwarden.desktop',
    'com.onepassword.onepassword',
];

/**
 * Check if the focused window belongs to an excluded application.
 *
 * @param {Meta.Window|null} window The focused window.
 * @param {string[]} [customExclusions=[]] User-configured blacklist.
 * @returns {boolean} True if window should be excluded.
 */
export function isWindowExcluded(window, customExclusions = []) {
    if (!window) return false;

    const allExclusions = [...DEFAULT_EXCLUDED_APPS, ...customExclusions]
        .map((s) => s.toLowerCase().trim())
        .filter(Boolean);

    const identifiers = [];

    // 1. Window Title
    const title = window.get_title();
    if (title) identifiers.push(title.toLowerCase());

    // 2. WM_CLASS (X11 & Wayland)
    const wmClass = window.get_wm_class();
    if (wmClass) identifiers.push(wmClass.toLowerCase());

    // 3. Desktop App ID and Name
    const tracker = Shell.WindowTracker.get_default();
    const app = tracker.get_window_app(window);
    if (app) {
        identifiers.push(app.get_name().toLowerCase());
        const appId = app.get_id();
        if (appId) {
            identifiers.push(appId.toLowerCase());
            identifiers.push(appId.toLowerCase().replace(/\.desktop$/, ''));
        }
    }

    return identifiers.some((id) =>
        allExclusions.some((excluded) => id.includes(excluded))
    );
}
```

---

## 3. Detecting In-Browser Extensions via AT-SPI

### The Problem
When a user copies a password from the 1Password or Bitwarden browser extension popup inside Firefox or Google Chrome:
* `window.get_wm_class()` is `google-chrome` or `firefox`.
* `window.get_title()` is the web page title or empty.
* The window-level check fails to identify that the copy originated from a password manager.

### The Solution: AT-SPI Accessibility Traversal
GNOME's Assistive Technology Service Provider Interface (AT-SPI) exposes the focused accessibility node inside the browser window. Walking up the accessibility hierarchy reveals the extension popup container.

```javascript
import Atspi from 'gi://Atspi';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export class BrowserExtensionGuard {
    constructor(excludedNames = ['bitwarden', '1password', 'lastpass', 'dashlane']) {
        this._excludedNames = excludedNames.map((s) => s.toLowerCase());
        this._listener = null;
        this._inExcludedContext = false;
        this._stickyExpiryTime = 0;
        this._stickyTtlMs = 2500; // 2.5s sticky window
        this._debounceTimeoutId = 0;
        this._pendingSource = null;
        this._knownBrowsers = new Set([
            'google-chrome', 'chrome', 'chromium', 'firefox', 'brave-browser',
            'microsoft-edge', 'opera', 'vivaldi', 'org.gnome.epiphany',
        ]);
        this._detectDefaultBrowser();
    }

    _detectDefaultBrowser() {
        try {
            const app = Gio.AppInfo.get_default_for_type('x-scheme-handler/http', false);
            if (app) {
                const id = app.get_id();
                if (id) this._knownBrowsers.add(id.toLowerCase().replace(/\.desktop$/, ''));
            }
        } catch {
            // Ignore failure in headless test environments
        }
    }

    start() {
        try {
            // Ensure system accessibility is active
            const a11ySettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
            if (!a11ySettings.get_boolean('toolkit-accessibility')) {
                a11ySettings.set_boolean('toolkit-accessibility', true);
            }

            if (!Atspi.is_initialized()) {
                Atspi.init();
            }

            this._listener = Atspi.EventListener.new((event) => {
                if (!event || !event.source || event.detail1 !== 1) return; // detail1 == 1 is focus gain
                
                // Debounce AT-SPI focus events by 40ms to avoid focus storms during DOM changes
                this._pendingSource = event.source;
                if (this._debounceTimeoutId) {
                    GLib.source_remove(this._debounceTimeoutId);
                }

                this._debounceTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 40, () => {
                    this._debounceTimeoutId = 0;
                    if (this._pendingSource) {
                        this._evaluateFocus(this._pendingSource);
                        this._pendingSource = null;
                    }
                    return GLib.SOURCE_REMOVE;
                });
            });

            this._listener.register('object:state-changed:focused');
        } catch (e) {
            console.warn(`AT-SPI initialization failed: ${e.message}`);
        }
    }

    _evaluateFocus(source) {
        try {
            // 1. Optimization Gate: Only walk parent hierarchy if inside a web browser!
            const app = source.get_application();
            const appName = (app ? app.get_name() : '') || '';
            const lowerAppName = appName.toLowerCase();

            // Check if application matches known browsers or matches excluded name directly
            const isBrowser = [...this._knownBrowsers].some((b) => lowerAppName.includes(b));
            const isDirectMatch = this._excludedNames.some((ex) => lowerAppName.includes(ex));

            if (isDirectMatch) {
                this._markStickyExcluded();
                return;
            }

            // If not a web browser, skip the expensive 30-level parent tree traversal
            if (!isBrowser) {
                return;
            }

            // 2. Traverse hierarchy inside browser window to find extension popup containers
            let current = source;
            let depth = 0;

            while (current && depth < 30) {
                const name = (current.get_name() || '').toLowerCase();
                const desc = (current.get_description() || '').toLowerCase();

                if (this._excludedNames.some((ex) => name.includes(ex) || desc.includes(ex))) {
                    this._markStickyExcluded();
                    return;
                }

                current = current.get_parent();
                depth++;
            }
        } catch {
            // Ignore ephemeral or destroyed accessible objects common during popup closure
        }
    }

    _markStickyExcluded() {
        this._inExcludedContext = true;
        this._stickyExpiryTime = GLib.get_monotonic_time() + (this._stickyTtlMs * 1000);
    }

    /**
     * Checks if the current context was recently inside an excluded extension.
     * Crucial because browser popups often close before clipboard change arrives!
     */
    isContextBlocked() {
        if (!this._inExcludedContext) return false;
        if (GLib.get_monotonic_time() > this._stickyExpiryTime) {
            this._inExcludedContext = false;
            return false;
        }
        return true;
    }

    destroy() {
        if (this._debounceTimeoutId) {
            GLib.source_remove(this._debounceTimeoutId);
            this._debounceTimeoutId = 0;
        }
        this._pendingSource = null;

        if (this._listener) {
            try {
                this._listener.deregister('object:state-changed:focused');
            } catch {}
            this._listener = null;
        }
    }
}
```

---

## 4. Self-Copy Loop Suppression (Hash Guard)

When a user clicks an item in the clipboard extension's UI to copy or paste it, `Meta.Selection` emits `owner-changed`. Without suppression, the extension captures its own item again, duplicating it and updating timestamps.

### The Guard Pattern
```javascript
import GLib from 'gi://GLib';

export class CaptureGuard {
    constructor() {
        this._registeredHashes = new Set();
    }

    /**
     * Compute SHA256 hash of a string or buffer.
     */
    static hashString(text) {
        return GLib.compute_checksum_for_string(GLib.ChecksumType.SHA256, text, -1);
    }

    static hashBytes(bytes) {
        return GLib.compute_checksum_for_bytes(GLib.ChecksumType.SHA256, bytes);
    }

    /**
     * Register a hash immediately before copying from extension UI.
     */
    registerHash(hash) {
        if (!hash) return;
        this._registeredHashes.add(hash);

        // Auto-expire after 2 seconds in case copy was cancelled
        GLib.timeout_add(GLib.PRIORITY_LOW, 2000, () => {
            this._registeredHashes.delete(hash);
            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Check and consume hash when handling owner-changed.
     * @returns {boolean} True if capture should be suppressed.
     */
    shouldSuppress(hash) {
        if (!hash) return false;
        if (this._registeredHashes.has(hash)) {
            this._registeredHashes.delete(hash);
            return true;
        }
        return false;
    }
}
```
