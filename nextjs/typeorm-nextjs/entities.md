# Entities: Decorators, Relational vs MongoDB, Strict Types & DTO Boundaries

## 1. Metadata Reflection & Decorator Architecture

TypeORM reads property types and relation signatures at runtime using TypeScript's experimental metadata reflection (`reflect-metadata`).

Every entity file must:
1. Import `"reflect-metadata"` at the top (or ensure it is evaluated before entity classes load).
2. Use TypeScript's definite assignment assertion operator (`!:`) on entity fields so TypeScript strict mode (`strictPropertyInitialization`) does not complain about properties populated by TypeORM at query time.

```ts
import "reflect-metadata";
import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 100 })
  name!: string;
}
```

---

## 2. Relational Database Modeling (PostgreSQL / MySQL)

For relational databases, use standard primary keys, column data types, foreign keys, and relations:

```ts
import "reflect-metadata";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  @Index("idx_users_email")
  email!: string;

  @Column()
  fullName!: string;

  @OneToMany(() => Post, (post) => post.author)
  posts!: Post[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

@Entity("posts")
export class Post {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  title!: string;

  @Column({ type: "text" })
  content!: string;

  @Column({ name: "author_id" })
  authorId!: string;

  // Relation definitions using arrow function targets to prevent circular dependency deadlocks
  @ManyToOne(() => User, (user) => user.posts, { onDelete: "CASCADE" })
  @JoinColumn({ name: "author_id" })
  author!: User;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
```

---

## 3. MongoDB Document Modeling

When targeting MongoDB, TypeORM requires `@ObjectIdColumn()` for document IDs, and supports complex embedded types, arrays, and JSON objects:

```ts
import "reflect-metadata";
import {
  Entity,
  ObjectIdColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ObjectId,
} from "typeorm";

export type AppStatus = "GREEN" | "GREEN*" | "AMBER*" | "RED*";

@Entity("applications")
export class Application {
  /**
   * MongoDB ObjectId primary key.
   * Represented as TypeORM `ObjectId` (from 'typeorm' or 'mongodb').
   */
  @ObjectIdColumn()
  _id!: ObjectId;

  /**
   * Application business identifier (CoriaID).
   */
  @Column({ unique: true })
  coriaId!: string;

  @Column()
  applicationName!: string;

  @Column()
  applicationStatus!: AppStatus;

  @Column({ default: false })
  default!: boolean;

  /**
   * Simple array column for primitive lists (e.g. string tags, subscriber IDs)
   */
  @Column("simple-array")
  subscribedGroupIds?: string[];

  /**
   * Storing structured nested objects / metadata as JSON
   */
  @Column("json")
  metadata?: Record<string, unknown>;

  @Column({ nullable: true })
  lastUpdated?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

---

## 4. Circular Dependency Protection in Next.js

In Next.js App Router, Webpack/Turbopack bundle server modules into isolated chunks. If two entity files import each other directly at the module root, a circular dependency deadlock can leave one entity class as `undefined` when decorators execute.

### The Fix:
1. **Always use arrow functions in relation decorators**:
   ```ts
   // ✅ GOOD: Target resolved lazily at runtime
   @OneToMany(() => Post, (post) => post.author)
   posts!: Post[];
   ```
   ```ts
   // ❌ BAD: Evaluates immediately; throws if Post is not yet loaded
   @OneToMany(Post, post => post.author)
   ```
2. **Avoid barrel file cross-imports**: Import entities directly from their specific file path (e.g., `import { Post } from "./Post.entity"`), not through a shared `index.ts` that imports all entities.

---

## 5. Strict Property Conventions & Database Mapping

- **TypeScript properties**: Always use `camelCase` (e.g., `applicationName`, `lastUpdated`, `coriaId`).
- **Database Tables/Collections**: Always use `snake_case` plural names in `@Entity("snake_case_names")`.
- **Database Columns (Relational)**: Explicitly map DB column names via `{ name: "snake_case_col" }` if table columns differ from TS properties.

---

## 6. DTO Mapping & Network Boundary Serialization

TypeORM entity instances are class objects containing internal metadata, non-enumerable properties, and dialect-specific objects (like MongoDB `ObjectId` or SQL driver prototypes).

**Never return raw TypeORM entities directly from Server Actions or Route Handlers to Client Components.** React Server Components require plain, JSON-serializable objects.

### DTO Interface & Converter Pattern

```ts
import type { ObjectId } from "typeorm";
import type { Application } from "@/database/entities/Application.entity";

/**
 * Plain serializable DTO for UI components and network responses
 */
export interface ApplicationData {
  id: string;              // Converted from ObjectId
  coriaId: string;
  applicationName: string;
  applicationStatus: "GREEN" | "GREEN*" | "AMBER*" | "RED*";
  default: boolean;
  lastUpdated?: string;    // ISO 8601 string
  createdAt: string;       // ISO 8601 string
  updatedAt: string;       // ISO 8601 string
}

/**
 * Pure converter function to map entity to DTO
 */
export const toApplicationData = (entity: Application): ApplicationData => ({
  id: entity._id ? entity._id.toString() : "",
  coriaId: entity.coriaId,
  applicationName: entity.applicationName,
  applicationStatus: entity.applicationStatus,
  default: Boolean(entity.default),
  lastUpdated: entity.lastUpdated ? entity.lastUpdated.toISOString() : undefined,
  createdAt: entity.createdAt ? entity.createdAt.toISOString() : new Date().toISOString(),
  updatedAt: entity.updatedAt ? entity.updatedAt.toISOString() : new Date().toISOString(),
});
```

