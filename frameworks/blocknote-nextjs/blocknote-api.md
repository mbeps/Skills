# BlockNote API Reference

## Core Hooks

### useCreateBlockNote

Creates and manages a BlockNoteEditor instance.

```typescript
import { useCreateBlockNote } from "@blocknote/react";

declare function useCreateBlockNote(
  options?: BlockNoteEditorOptions,
  deps?: React.DependencyList,
): BlockNoteEditor;
```

**Parameters:**
- `options` - Configuration object (see [blocknote-config.md](./blocknote-config.md))
- `deps` - React dependency array controlling when editor recreates

**Returns:** `BlockNoteEditor` instance

**Example:**
```tsx
const editor = useCreateBlockNote({
  initialContent: parsedContent,
  uploadFile: handleUpload,
}, [initialContent]);  // Recreate when initialContent changes
```

### useEditorChange

Listen for content changes with detailed change info.

```typescript
import { useEditorChange } from "@blocknote/react";

declare function useEditorChange(
  callback: (editor: BlockNoteEditor, ctx: { getChanges(): BlocksChanged }) => void,
  editor?: BlockNoteEditor,
): BlockNoteEditor;
```

**Parameters:**
- `callback` - Called on content changes with editor and change context
- `editor` - Optional editor instance (uses default if omitted)

**Example:**
```tsx
useEditorChange((editor, ctx) => {
  const changes = ctx.getChanges();
  console.log(`${changes.blocksAdded.length} blocks added`);
  onChange(JSON.stringify(editor.document, null, 2));
}, editor);
```

### useEditorSelectionChange

Listen for selection changes.

```typescript
import { useEditorSelectionChange } from "@blocknote/react";

declare function useEditorSelectionChange(
  callback: () => void,
  editor?: BlockNoteEditor,
): BlockNoteEditor;
```

**Example:**
```tsx
useEditorSelectionChange(() => {
  console.log("Selection changed");
}, editor);
```

## BlockNoteEditor Methods

### Document Access

```typescript
interface BlockNoteEditor {
  // Get full document
  getDocument(): Block[];

  // Get document as JSON-serializable
  document: Block[];

  // Get block by ID
  getBlockById(id: string): Block | null;

  // Get selected blocks
  getSelectedBlocks(): Block[];

  // Check if block is selected
  isBlockSelected(block: Block): boolean;
}
```

### Document Manipulation

```typescript
interface BlockNoteEditor {
  // Insert block after reference block
  insertBlockAfter(block: PartialBlock, referenceBlock: Block): Block;

  // Insert block before reference block
  insertBlockBefore(block: PartialBlock, referenceBlock: Block): Block;

  // Replace block
  replaceBlock(block: Block, newBlock: PartialBlock): Block;

  // Delete block
  deleteBlock(block: Block): void;

  // Delete blocks
  deleteBlocks(blocks: Block[]): void;

  // Move block to new parent
  moveBlock(block: Block, newParent: Block | null, index?: number): void;

  // Duplicate block
  duplicateBlock(block: Block): Block;
}
```

### Content Manipulation

```typescript
interface BlockNoteEditor {
  // Set block content
  setBlockContent(block: Block, content: InlineContent[]): void;

  // Append content to block
  appendBlockContent(block: Block, content: InlineContent[]): void;

  // Insert content at position
  insertContentAtPosition(position: { block: Block; index: number }, content: InlineContent[]): void;
}
```

### Selection

```typescript
interface BlockNoteEditor {
  // Select blocks
  selectBlocks(blocks: Block[]): void;

  // Clear selection
  clearSelection(): void;

  // Get selection range
  getSelection(): { from: Position; to: Position } | null;
}
```

### Transaction

```typescript
interface BlockNoteEditor {
  // Batch multiple operations
  transaction<T>(fn: () => T): T;
}
```

**Example:**
```tsx
editor.transaction(() => {
  editor.deleteBlock(block1);
  editor.deleteBlock(block2);
  editor.insertBlockAfter(newBlock, referenceBlock);
});
```

## Block Types

### Built-in Block Types

| Type           | Description             | Key Props                   |
| -------------- | ----------------------- | --------------------------- |
| `paragraph`    | Plain text paragraph    | `textAlignment`             |
| `heading`      | Headings H1-H6          | `level` (1-6)               |
| `bulletList`   | Bullet list container   | -                           |
| `numberedList` | Numbered list container | -                           |
| `checkList`    | Checkbox list           | -                           |
| `toggle`       | Collapsible toggle      | -                           |
| `quote`        | Block quote             | -                           |
| `code`         | Code block              | `language`                  |
| `image`        | Image embed             | `url`, `caption`, `altText` |
| `video`        | Video embed             | `url`, `caption`            |
| `audio`        | Audio embed             | `url`, `caption`            |
| `file`         | File attachment         | `url`, `name`, `caption`    |
| `divider`      | Horizontal divider      | -                           |
| `table`        | Table container         | -                           |

### Block Structure

```typescript
type Block = {
  id: string;
  type: string;
  props: Record<string, boolean | number | string>;
  content: InlineContent[] | TableContent | undefined;
  children: Block[];
};

type PartialBlock = Omit<Block, "id"> | { id: string };
```

### Inline Content

```typescript
type InlineContent = StyledText | Link | CustomInlineContent;

type StyledText = {
  type: "text";
  text: string;
  styles: Styles;
};

type Link = {
  type: "link";
  content: StyledText[];
  href: string;
  target?: string;
};

type Styles = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  textColor?: string;
  backgroundColor?: string;
};
```

## BlockNoteView Props

```typescript
interface BlockNoteViewProps {
  editor: BlockNoteEditor;
  theme?: Theme | "light" | "dark";
  editable?: boolean;
  onChange?: () => void;
  onSelectionChange?: () => void;
  renderEditor?: (props: RenderEditorProps) => React.ReactNode;
  children?: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement>;
  formattingToolbar?: boolean | React.ReactNode;
  linkToolbar?: boolean | React.ReactNode;
  slashMenu?: boolean | React.ReactNode;
  sideMenu?: boolean | React.ReactNode;
  filePanel?: boolean | React.ReactNode;
  tableHandles?: boolean | React.ReactNode;
  emojiPicker?: boolean | React.ReactNode;
  portalElements?: PortalElements;
  shadCNComponents?: ShadCNComponents;  // For @blocknote/shadcn
}
```

## Utility Functions

### Block Note Schema

```typescript
import { BlockNoteSchema, createHeadingBlockSpec } from "@blocknote/core";

// Create custom schema
const schema = BlockNoteSchema.create().extend({
  blockSpecs: {
    heading: createHeadingBlockSpec({
      levels: [1, 2, 3],  // Only allow H1-H3
    }),
  },
  // Custom block types can be added here
});
```

### Serialization

```typescript
// Convert document to JSON string
const jsonString = JSON.stringify(editor.document, null, 2);

// Parse JSON back to blocks
const blocks = JSON.parse(jsonString) as PartialBlock[];
```

## Common Patterns

### Debounced onChange

```tsx
import { useEffect, useRef } from "react";

function Editor({ onChange }) {
  const editor = useCreateBlockNote();
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleChange = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onChange(JSON.stringify(editor.document, null, 2));
    }, 500);  // 500ms debounce
  };

  return (
    <BlockNoteView editor={editor} onChange={handleChange} />
  );
}
```

### Track Dirty State

```tsx
function Editor({ initialContent, onChange }) {
  const editor = useCreateBlockNote({
    initialContent: initialContent ? JSON.parse(initialContent) : undefined,
  });

  const [isDirty, setIsDirty] = useState(false);

  useEditorChange(() => {
    setIsDirty(
      JSON.stringify(editor.document) !== initialContent
    );
  });

  return (
    <BlockNoteView editor={editor} onChange={() => onChange(JSON.stringify(editor.document))} />
  );
}
```

### Focus Management

```tsx
import { useRef, useEffect } from "react";

function Editor() {
  const editor = useCreateBlockNote();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus editor on mount
    containerRef.current?.focus();
  }, [editor]);

  return (
    <BlockNoteView editor={editor} ref={containerRef} />
  );
}
```

### Read-Only with Preview

```tsx
function PreviewEditor({ content }) {
  const editor = useCreateBlockNote({
    initialContent: content ? JSON.parse(content) : undefined,
  });

  return (
    <BlockNoteView editor={editor} editable={false} />
  );
}
```
