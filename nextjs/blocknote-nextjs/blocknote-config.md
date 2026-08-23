# BlockNote Configuration Reference

## Editor Options (`BlockNoteEditorOptions`)

Passed to `useCreateBlockNote()` or `BlockNoteEditor.create()`.

| Option              | Type                                 | Default                  | Description                                  |
| ------------------- | ------------------------------------ | ------------------------ | -------------------------------------------- |
| `initialContent`    | `PartialBlock[]`                     | `undefined`              | Starting document content as array of blocks |
| `schema`            | `BlockNoteSchema`                    | Default schema           | Custom blocks, styles, and configuration     |
| `uploadFile`        | `(file: File) => Promise<string>`    | `undefined`              | Handle file uploads, return public URL       |
| `pasteHandler`      | `PasteHandler`                       | Default handler          | Custom paste content parsing                 |
| `dictionary`        | `Dictionary`                         | English defaults         | Localization/custom text strings             |
| `extensions`        | `Extension[]`                        | `[]`                     | Add keyboard shortcuts, input rules, plugins |
| `links`             | `LinksOptions`                       | `{ openOnClick: true }`  | Configure link behavior                      |
| `tabBehavior`       | `TabBehaviorOptions`                 | `{ insertSpaces: true }` | Control tab key behavior                     |
| `animations`        | `boolean`                            | `true`                   | Enable/disable animations                    |
| `autofocus`         | `boolean`                            | `true`                   | Auto-focus editor on mount                   |
| `defaultStyles`     | `Styles`                             | Default styles           | Default text styles for new content          |
| `disableExtensions` | `string[]`                           | `[]`                     | Disable specific built-in extensions         |
| `domAttributes`     | `Record<string, string>`             | `{}`                     | Custom DOM attributes on editor element      |
| `dropCursor`        | `boolean`                            | `true`                   | Show drop cursor when dragging               |
| `resolveFileUrl`    | `(url: string) => string`            | Identity                 | Transform file URLs after upload             |
| `setIdAttribute`    | `(id: string, block: Block) => void` | Default                  | Custom ID attribute setter                   |
| `tables`            | `TablesOptions`                      | Default                  | Table configuration                          |
| `trailingBlock`     | `boolean`                            | `true`                   | Add trailing empty block at end              |

## disableExtensions Values

Built-in extensions that can be disabled:

| Extension ID      | What it does                     |
| ----------------- | -------------------------------- |
| `emojiPicker`     | Emoji picker in slash menu       |
| `linkEditing`     | Link editing UI (click to edit)  |
| `tableOfContents` | Table of contents generation     |
| `collaboration`   | Real-time collaboration features |

## LinksOptions

```typescript
type LinksOptions = {
  openOnClick?: boolean;        // Open link when clicked (default: true)
  modifyLinkOnPaste?: boolean; // Transform pasted links (default: true)
};
```

## TabBehaviorOptions

```typescript
type TabBehaviorOptions = {
  insertSpaces?: boolean;  // Insert spaces instead of tabs (default: true)
  indentSize?: number;     // Number of spaces per indent (default: 2)
};
```

## TablesOptions

```typescript
type TablesOptions = {
  defaultRowCount?: number;     // Default rows in new table (default: 3)
  defaultColumnCount?: number;  // Default columns (default: 3)
  enableRowSelection?: boolean; // Allow row selection (default: true)
  enableColumnSelection?: boolean; // Allow column selection (default: true)
};
```

## Dictionary (Localization)

```typescript
type Dictionary = {
  blockTypeLabels?: Record<string, string>;  // Custom block type names
  slashMenu?: {
    placeholder?: string;
    noResults?: string;
    categories?: {
      label: string;
      blocks: string[];
    }[];
  };
  link?: {
    editPlaceholder?: string;
    urlPlaceholder?: string;
  };
  // ... more keys
};
```

## Example: Complete Configuration

```typescript
const editor = useCreateBlockNote({
  // Start with content
  initialContent: [
    { type: "heading", content: "Title", props: { level: 1 } },
    { type: "paragraph", content: [{ type: "text", text: "Start here" }] },
  ],

  // File uploads
  uploadFile: async (file) => {
    const response = await uploadToStorage(file);
    return response.url;
  },

  // Custom schema
  schema: BlockNoteSchema.create().extend({
    blockSpecs: {
      heading: createHeadingBlockSpec({ levels: [1, 2, 3] }),
    },
  }),

  // Disable features
  disableExtensions: ["emojiPicker"],

  // Link behavior
  links: {
    openOnClick: true,
    modifyLinkOnPaste: true,
  },

  // Tab behavior
  tabBehavior: {
    insertSpaces: true,
    indentSize: 2,
  },

  // Disable animations for performance
  animations: true,

  // Custom DOM attributes
  domAttributes: {
    class: "my-custom-editor",
    "data-testid": "blocknote-editor",
  },
});
```

## Theme Configuration

### Built-in Themes

```typescript
import { lightDefaultTheme, darkDefaultTheme } from "@blocknote/mantine";

// Use built-in themes
<BlockNoteView editor={editor} theme="light" />
<BlockNoteView editor={editor} theme="dark" />
```

### Custom Theme Object

```typescript
import { Theme } from "@blocknote/mantine";

const customTheme: Theme = {
  colors: {
    editor: { text: "#222", background: "#fff" },
    menu: { text: "#333", background: "#f5f5f5" },
    tooltip: { text: "#fff", background: "#333" },
    hovered: { text: "#fff", background: "#0066cc" },
    selected: { text: "#fff", background: "#004499" },
    disabled: { text: "#999", background: "#eee" },
    shadow: "#ccc",
    border: "#ddd",
    sideMenu: "#eee",
    highlights: {
      gray: { text: "#666", background: "#f0f0f0" },
      brown: { text: "#5d4037", background: "#efebe9" },
      red: { text: "#b71c1c", background: "#ffebee" },
      orange: { text: "#e65100", background: "#fff3e0" },
      yellow: { text: "#f57f17", background: "#fffde7" },
      green: { text: "#1b5e20", background: "#e8f5e9" },
      blue: { text: "#0d47a1", background: "#e3f2fd" },
      purple: { text: "#6a1b9a", background: "#f3e5f5" },
      pink: { text: "#880e4f", background: "#fce4ec" },
    },
  },
  borderRadius: 6,
  fontFamily: "Inter, sans-serif",
};
```

### Theme Pair (Light + Dark)

```typescript
const brandTheme = {
  light: {
    ...lightDefaultTheme,
    colors: {
      ...lightDefaultTheme.colors!,
      editor: { text: "#333", background: "#ffffff" },
      menu: { text: "#333", background: "#f8f9fa" },
    },
  },
  dark: {
    ...darkDefaultTheme,
    colors: {
      ...darkDefaultTheme.colors!,
      editor: { text: "#e0e0e0", background: "#1a1a1a" },
      menu: { text: "#e0e0e0", background: "#2d2d2d" },
    },
  },
} satisfies { light: Theme; dark: Theme };

<BlockNoteView editor={editor} theme={brandTheme} />
```

## CSS Variables Reference

### Light Theme Defaults

```css
.bn-root[data-color-scheme="light"] {
  --bn-colors-editor-text: #3f3f3f;
  --bn-colors-editor-background: #ffffff;
  --bn-colors-menu-text: #3f3f3f;
  --bn-colors-menu-background: #ffffff;
  --bn-colors-tooltip-text: #3f3f3f;
  --bn-colors-tooltip-background: #efefef;
  --bn-colors-hovered-text: #3f3f3f;
  --bn-colors-hovered-background: #efefef;
  --bn-colors-selected-text: #ffffff;
  --bn-colors-selected-background: #3f3f3f;
  --bn-colors-disabled-text: #afafaf;
  --bn-colors-disabled-background: #efefef;
  --bn-colors-shadow: #cfcfcf;
  --bn-colors-border: #efefef;
  --bn-colors-side-menu: #cfcfcf;
  --bn-font-family: "Inter", sans-serif;
  --bn-border-radius: 6px;
}
```

### Dark Theme Defaults

```css
.bn-root[data-color-scheme="dark"] {
  --bn-colors-editor-text: #cfcfcf;
  --bn-colors-editor-background: #1a1a1a;
  --bn-colors-menu-text: #cfcfcf;
  --bn-colors-menu-background: #2d2d2d;
  --bn-colors-tooltip-text: #cfcfcf;
  --bn-colors-tooltip-background: #3d3d3d;
  --bn-colors-hovered-text: #ffffff;
  --bn-colors-hovered-background: #3d3d3d;
  --bn-colors-selected-text: #ffffff;
  --bn-colors-selected-background: #0066cc;
  --bn-colors-disabled-text: #7d7d7d;
  --bn-colors-disabled-background: #3d3d3d;
  --bn-colors-shadow: #000000;
  --bn-colors-border: #3d3d3d;
  --bn-colors-side-menu: #3d3d3d;
}
```

## BlockNoteView Props

| Prop                 | Type                         | Description                    |
| -------------------- | ---------------------------- | ------------------------------ |
| `editor`             | `BlockNoteEditor`            | **Required** - Editor instance |
| `theme?`             | `Theme \| "light" \| "dark"` | Theme configuration            |
| `editable?`          | `boolean`                    | Read-only when false           |
| `onChange?`          | `() => void`                 | Content change callback        |
| `onSelectionChange?` | `() => void`                 | Selection change callback      |
| `renderEditor?`      | Custom render function       | Override rendering             |
| `children?`          | `React.ReactNode`            | Child components               |
| `ref?`               | `React.RefObject`            | Component ref                  |
| `formattingToolbar?` | `boolean \| ReactNode`       | Custom toolbar                 |
| `linkToolbar?`       | `boolean \| ReactNode`       | Custom link toolbar            |
| `slashMenu?`         | `boolean \| ReactNode`       | Custom slash menu              |
| `sideMenu?`          | `boolean \| ReactNode`       | Custom side menu               |
| `filePanel?`         | `boolean \| ReactNode`       | Custom file panel              |
| `tableHandles?`      | `boolean \| ReactNode`       | Custom table handles           |
| `emojiPicker?`       | `boolean \| ReactNode`       | Custom emoji picker            |
| `portalElements?`    | `PortalElements`             | Portal target configuration    |

## PortalElements

For layouts with `overflow: hidden` or modal stacking:

```typescript
type PortalElements = {
  default?: HTMLElement;
  formattingToolbar?: HTMLElement;
  linkToolbar?: HTMLElement;
  slashMenu?: HTMLElement;
  sideMenu?: HTMLElement;
  filePanel?: HTMLElement;
  tableHandles?: HTMLElement;
  emojiPicker?: HTMLElement;
};

<BlockNoteView
  editor={editor}
  portalElements={{
    default: document.body,
    formattingToolbar: document.body,
  }}
/>
```
