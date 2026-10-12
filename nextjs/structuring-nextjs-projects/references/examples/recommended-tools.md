# Worked Example: Recommended Tools & Libraries in Action

Implementations demonstrating Zustand state stores, BlockNote rich text editor, Drizzle ORM, TypeORM Data Mapper singleton, and `mcp-handler` Model Context Protocol routes.

## Example 9: Default Recommended Tools & Libraries in Action

### Scenario
A feature requiring dedicated client-side state (Zustand), interactive rich text editing (BlockNote), Tailwind CSS styling with Shadcn/Base UI, database persistence via Drizzle/TypeORM/MongoDB, and exposing an MCP server route via `mcp-handler`.

---

### 1. Dedicated State Management with Zustand (`stores/player-store.ts`)

```typescript
'use client';

import { create } from 'zustand';

interface PlayerState {
  currentTrackId: string | null;
  isPlaying: boolean;
  setTrack: (id: string) => void;
  togglePlay: () => void;
}

const usePlayerStore = create<PlayerState>((set) => ({
  currentTrackId: null,
  isPlaying: false,
  setTrack: (id: string) => set({ currentTrackId: id, isPlaying: true }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
}));

export default usePlayerStore;
```

---

### 2. Interactive Markdown Editor with BlockNote (`components/notes/note-editor.tsx`)

```typescript
'use client';

import dynamic from 'next/dynamic';

// BlockNote requires dynamic import with ssr: false to prevent browser API hydration errors
const EditorContent = dynamic(
  () => import('@/components/notes/editor-content'),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded bg-muted" /> }
);

interface NoteEditorProps {
  initialContent?: string;
  onChange: (content: string) => void;
}

export default function NoteEditor({ initialContent, onChange }: NoteEditorProps) {
  return (
    <div className="rounded-lg border border-border p-4 bg-background">
      <EditorContent initialContent={initialContent} onChange={onChange} />
    </div>
  );
}
```

---

### 3. Database Layer Examples (Drizzle ORM & TypeORM)

#### Drizzle ORM Client (`drizzle/db.ts`)

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/drizzle/schemas/index';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
```

#### TypeORM DataSource Singleton (`database/data-source.ts`)

```typescript
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SongEntity } from '@/database/entities/song.entity';

let dataSourceInstance: DataSource | null = null;
let initPromise: Promise<DataSource> | null = null;

export async function getDataSource(): Promise<DataSource> {
  if (dataSourceInstance?.isInitialized) {
    return dataSourceInstance;
  }
  if (!initPromise) {
    const ds = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [SongEntity],
      synchronize: false,
    });
    initPromise = ds.initialize().then((initialized) => {
      dataSourceInstance = initialized;
      return initialized;
    });
  }
  return initPromise;
}
```

---

### 4. Next.js MCP Server Route Handler (`app/api/mcp/route.ts`)

```typescript
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import getSongs from '@/actions/song/get-songs';

const handler = createMcpHandler((server) => {
  server.registerTool(
    'list_songs',
    {
      title: 'List Songs',
      description: 'Retrieve songs available in the streaming platform',
      inputSchema: z.object({
        limit: z.number().optional().default(10),
      }),
    },
    async ({ limit }) => {
      const songs = await getSongs();
      return {
        content: [{ type: 'text', text: JSON.stringify(songs.slice(0, limit)) }],
      };
    }
  );
});

export const { GET, POST } = handler;
```

