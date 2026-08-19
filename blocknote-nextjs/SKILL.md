---
name: blocknote-nextjs
description: Use when integrating BlockNote rich text editor with Next.js App Router, handling SSR issues, file uploads, theme sync, or customizing the editor
---

# BlockNote with Next.js

## Overview

BlockNote is a block-based rich text editor for React (Notion-style). Integrates with Next.js App Router but requires careful SSR handling since it accesses browser APIs.

**Core principle:** BlockNote must be dynamically imported with `ssr: false` in Next.js App Router to prevent server-side rendering errors.

## When to Use

- Adding rich text editing to a Next.js page
- Handling "window is not defined" or hydration errors with BlockNote
- Integrating file uploads (EdgeStore, Supabase, etc.)
- Syncing editor theme with next-themes
- Customizing toolbars, menus, or block types
- Reading/writing BlockNote document JSON

## Quick Start

### Installation

```bash
npm install @blocknote/core @blocknote/react @blocknote/mantine
npm install @mantine/core @mantine/hooks @mantine/utils
```

For Shadcn/ui instead of Mantine:
```bash
npm install @blocknote/shadcn
```

### Basic Setup

**1. Create the editor component** (`components/Editors/Editor.tsx`):

```tsx
"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

interface EditorProps {
  onChange: (value: string) => void;
  initialContent?: string;
  editable?: boolean;
}

export default function Editor({ onChange, initialContent, editable = true }: EditorProps) {
  const editor = useCreateBlockNote({
    initialContent: initialContent ? JSON.parse(initialContent) : undefined,
  });

  return (
    <BlockNoteView
      editor={editor}
      editable={editable}
      onChange={() => onChange(JSON.stringify(editor.document, null, 2))}
    />
  );
}
```

**2. Dynamic import in page** (required for SSR):

```tsx
"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

export default function Page() {
  const Editor = useMemo(
    () => dynamic(() => import("@/components/Editors/Editor"), { ssr: false }),
    []
  );

  return <Editor onChange={(content) => console.log(content)} />;
}
```

**Alternative:** If the editor is only used in client components, add `"use client"` and import directly without dynamic.

### Real-World Example: Joker Notes

The Joker Notes project demonstrates a complete BlockNote + Next.js + Convex + EdgeStore integration:

**Editor component** (`components/Editors/Editor.tsx`):
- Uses `"use client"` directive
- Syncs theme with `next-themes` via `resolvedTheme`
- Handles file uploads through EdgeStore's `uploadFile` handler
- Serializes document on every change

**Preview page** (`app/(public)/(routes)/preview/[documentId]/page.tsx`):
- Uses `dynamic(() => import(...), { ssr: false })` for SSR safety
- Renders editor in read-only mode (`editable={false}`)
- Fetches document via Convex `useQuery`
- Persists changes via Convex `useMutation`

## File Uploads

BlockNote calls `uploadFile` when users embed files. Return a public URL.

```tsx
const handleUpload = async (file: File): Promise<string> => {
  // EdgeStore example
  const response = await edgestore.publicFiles.upload({ file });
  return response.url;

  // Supabase example
  const { data } = await supabase.storage.from("uploads").upload(`${file.name}`, file);
  const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(data.path);
  return urlData.publicUrl;
};

const editor = useCreateBlockNote({
  uploadFile: handleUpload,
});
```

## Theme Synchronization

Sync with `next-themes`:

```tsx
import { useTheme } from "next-themes";

function Editor() {
  const { resolvedTheme } = useTheme();

  return (
    <BlockNoteView
      editor={editor}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}
```

For custom themes:

```tsx
import { lightDefaultTheme, darkDefaultTheme, Theme } from "@blocknote/mantine";

const customTheme = {
  light: {
    ...lightDefaultTheme,
    colors: {
      ...lightDefaultTheme.colors!,
      editor: { text: "#333", background: "#fff" },
    },
  },
  dark: {
    ...darkDefaultTheme,
    colors: {
      ...darkDefaultTheme.colors!,
      editor: { text: "#fff", background: "#1a1a1a" },
    },
  },
} satisfies { light: Theme; dark: Theme };

<BlockNoteView editor={editor} theme={customTheme} />
```

## Common Customizations

### Disable Specific Extensions

```tsx
const editor = useCreateBlockNote({
  disableExtensions: ["emojiPicker", "linkEditing"],
});
```

### Custom Formatting Toolbar

```tsx
import {
  FormattingToolbar,
  FormattingToolbarController,
  BlockTypeSelect,
  BasicTextStyleButton,
} from "@blocknote/react";

const CustomToolbar = () => (
  <FormattingToolbar>
    <BlockTypeSelect key="blockType" />
    <BasicTextStyleButton basicTextStyle="bold" key="bold" />
    <BasicTextStyleButton basicTextStyle="italic" key="italic" />
  </FormattingToolbar>
);

<BlockNoteView
  editor={editor}
  formattingToolbar={false}
>
  <FormattingToolbarController formattingToolbar={CustomToolbar} />
</BlockNoteView>
```

### Custom Schema (Limit Heading Levels)

```tsx
import { BlockNoteSchema, createHeadingBlockSpec } from "@blocknote/core";

const editor = useCreateBlockNote({
  schema: BlockNoteSchema.create().extend({
    blockSpecs: {
      heading: createHeadingBlockSpec({ levels: [1, 2, 3] }),
    },
  }),
});
```

### Read-Only Mode

```tsx
<BlockNoteView editor={editor} editable={false} />
```

## TypeScript Types

Key types from `@blocknote/core`:

```typescript
import { BlockNoteEditor, PartialBlock, InlineContent, Styles } from "@blocknote/core";

// Block structure
type Block = {
  id: string;
  type: string;  // "paragraph", "heading", "image", etc.
  props: Record<string, boolean | number | string>;
  content: InlineContent[] | undefined;
  children: Block[];
};

// Editor hook
declare function useCreateBlockNote(
  options?: {
    initialContent?: PartialBlock[];
    uploadFile?: (file: File) => Promise<string>;
    schema?: BlockNoteSchema;
    disableExtensions?: string[];
    // ... more options
  },
  deps?: React.DependencyList,
): BlockNoteEditor;
```

## Shadcn/ui Integration

If using Shadcn instead of Mantine:

```bash
npm install @blocknote/shadcn
```

```tsx
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";

// In globals.css, add:
@source "../node_modules/@blocknote/shadcn";

// Usage
<BlockNoteView
  editor={editor}
  shadCNComponents={{
    Button: MyButton,
    Select: MySelect,
  }}
/>
```

**Note:** Custom Shadcn components should NOT use Portals.

## SSR Handling Patterns

### Pattern 1: Dynamic Import (Recommended)

```tsx
// components/DynamicEditor.tsx
"use client";
import dynamic from "next/dynamic";
export const Editor = dynamic(() => import("./Editor"), { ssr: false });
```

### Pattern 2: Client-Only Component

```tsx
// Editor.tsx
"use client";
// ... imports and component
```

Then import directly in other client components.

### Pattern 3: Lazy Loading with Suspense

```tsx
import { Suspense } from "react";
import dynamic from "next/dynamic";

const Editor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: () => <div>Loading editor...</div>,
});

function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Editor />
    </Suspense>
  );
}
```

## Common Issues

| Issue | Solution |
|-------|----------|
| "window is not defined" | Use `dynamic(..., { ssr: false })` |
| Hydration mismatch | Ensure editor only renders client-side |
| Theme not syncing | Use `resolvedTheme` from `useTheme()` |
| File uploads fail | Ensure `uploadFile` returns public URL string |
| Styles not loading | Import CSS files: `@blocknote/mantine/style.css` |
| Custom fonts not applied | Import `@blocknote/core/fonts/inter.css` |

## Reference Files

- [blocknote-config.md](./blocknote-config.md) - Full configuration options reference
- [blocknote-api.md](./blocknote-api.md) - API reference for hooks and types
