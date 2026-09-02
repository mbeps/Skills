# Migrations & Idempotent Seeding

## 1. Schema Management: `synchronize` vs Migrations

| Environment / DB Type                     | Strategy                                         | Reason                                                                                                |
| ----------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **MongoDB (Development & Production)**    | `synchronize: true` or manual collection indexes | MongoDB is schema-less; TypeORM collections and indexes auto-create without destructive table alters. |
| **Relational SQL (Development)**          | `synchronize: true` (local only)                 | Rapid prototyping of columns and relations without creating migration files on every tweak.           |
| **Relational SQL (Staging & Production)** | **Strict Migrations (`synchronize: false`)**     | Prevents automatic dropping of columns/tables; full audit trail of SQL changes.                       |

> **Warning:** NEVER set `synchronize: true` in production SQL databases (PostgreSQL, MySQL, Oracle). A renamed TypeScript property will cause TypeORM to drop the old column along with all its data.

---

## 2. Relational SQL Migrations Workflow

### Step 1: Create a CLI DataSource (`database/data-source.cli.ts`)

TypeORM CLI commands require a dedicated `DataSource` export without Next.js runtime dependencies (`next/config` or `@/` aliases that the CLI node runner might not resolve without ts-node).

```ts
import "reflect-metadata";
import { DataSource } from "typeorm";
import { Application } from "./entities/Application.entity";
import { Group } from "./entities/Group.entity";
import { SystemMessage } from "./entities/SystemMessage.entity";

export default new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "app_status",
  entities: [Application, Group, SystemMessage],
  migrations: ["database/migrations/*.ts"],
  synchronize: false,
  logging: true,
});
```

### Step 2: Configure NPM Scripts (`package.json`)

```json
{
  "scripts": {
    "typeorm": "typeorm-ts-node-commonjs -d database/data-source.cli.ts",
    "migration:generate": "npm run typeorm -- migration:generate database/migrations/Migration",
    "migration:run": "npm run typeorm -- migration:run",
    "migration:revert": "npm run typeorm -- migration:revert",
    "migration:create": "typeorm-ts-node-commonjs migration:create"
  }
}
```

### Step 3: Migration Workflow Loop
1. Modify entity classes in `database/entities/*.ts`.
2. Generate migration: `npm run migration:generate -- -n AddStatusColumnToApp`.
3. Review the generated `.ts` migration file in `database/migrations/`.
4. Run migration: `npm run migration:run`.

---

## 3. Idempotent Seeding Architecture

In Next.js, applications may boot across multiple worker threads, cluster processes, or serverless container replicas. Seeding must be **completely idempotent** (running multiple times concurrently or sequentially produces the exact same state without creating duplicate records or throwing primary key violations).

### Execution Hook inside `getDataSource()`

The seeder runs automatically on the first connection during startup:

```ts
// Inside database/data-source.ts initialization
await dataSourceInstance.initialize();
await seedDatabase(dataSourceInstance);
```

### Seeding Implementation (`database/seeds/index.ts`)

```ts
import type { DataSource } from "typeorm";
import { Application } from "../entities/Application.entity";
import { SystemSettings } from "../entities/SystemSettings.entity";
import { DEFAULT_SYSTEM_SETTINGS } from "@/constants/system-settings-constants";

/**
 * Root database seeder.
 * Runs atomically and idempotently across application restarts.
 */
export async function seedDatabase(dataSource: DataSource): Promise<void> {
  console.log("[Seeding] Running idempotent database seeds...");
  
  await seedDefaultApplications(dataSource);
  await seedSystemSettings(dataSource);
  
  console.log("[Seeding] Database seeding complete.");
}

/**
 * Seed default monitored applications if they do not exist
 */
async function seedDefaultApplications(dataSource: DataSource): Promise<void> {
  const repository = dataSource.getMongoRepository(Application); // or getRepository(Application) for SQL

  const defaultApps = [
    { coriaId: "CORIA-SYS-01", applicationName: "Core Banking Gateway", default: true, applicationStatus: "GREEN" },
    { coriaId: "CORIA-AUTH-02", applicationName: "Keycloak Token Service", default: true, applicationStatus: "GREEN" },
    { coriaId: "CORIA-NOTIF-03", applicationName: "Refinitiv Market Feed", default: true, applicationStatus: "GREEN" },
  ];

  for (const appData of defaultApps) {
    const exists = await repository.findOne({ where: { coriaId: appData.coriaId } as any });
    if (!exists) {
      const app = repository.create(appData);
      await repository.save(app);
      console.log(`[Seeding] Created default application: ${appData.coriaId} (${appData.applicationName})`);
    }
  }
}

/**
 * Seed initial system configuration from environment variables or defaults
 */
async function seedSystemSettings(dataSource: DataSource): Promise<void> {
  const repository = dataSource.getMongoRepository(SystemSettings);

  const existingSettings = await repository.findOne({ where: {} as any });
  if (!existingSettings) {
    const initialSettings = repository.create({
      autoRefreshIntervalSeconds: parseInt(process.env.DEFAULT_REFRESH_INTERVAL || "30", 10),
      maintenanceMode: false,
      alertBannerText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await repository.save(initialSettings);
    console.log("[Seeding] Initialized system settings.");
  }
}
```

### Best Practices for Idempotent Seeding:
1. **Always check before insert**: Use `findOne({ where: { uniqueKey } })` before calling `save()`.
2. **Never wipe data on startup**: Avoid `repository.clear()` or `repository.delete({})` in automated seeds.
3. **Environment variable override**: Allow seeding values (such as admin emails or refresh intervals) to read from environment defaults when first seeded.

