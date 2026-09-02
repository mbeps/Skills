# Setup: Dependencies, Configuration, DataSource Singleton & Instrumentation

## 1. Dependencies Installation

TypeORM requires `reflect-metadata` for TypeScript decorator reflection, along with the appropriate database driver.

```bash
# Core TypeORM packages
npm install typeorm reflect-metadata

# Database Driver (choose based on your dialect)
npm install mongodb     # For MongoDB
# OR
npm install pg          # For PostgreSQL
# OR
npm install mysql2      # For MySQL / MariaDB

# Schema validation & environment management (recommended)
npm install zod
```

---

## 2. TypeScript Configuration (`tsconfig.json`)

TypeORM relies on legacy experimental decorators and design-time type metadata emission.

Ensure `tsconfig.json` contains:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    
    /* TypeORM Decorator Requirements */
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

> **Warning:** If `"emitDecoratorMetadata"` is `false` or omitted, TypeORM cannot infer column and relation property types automatically, causing cryptic runtime errors when bootstrapping the `DataSource`.

---

## 3. Next.js Bundler Configuration (`next.config.ts`)

Next.js bundles server-side code using Webpack or Turbopack. TypeORM uses dynamic `require()` statements to load drivers and entities dynamically, which causes Webpack warnings and bundling issues without proper externalization.

```ts
import type { NextConfig } from "next";
import crypto from "node:crypto";

// 1. Stable encryption key for Server Actions across builds and restarts
if (!process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY) {
  process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY = crypto
    .createHash("sha256")
    .update("app-status-stable-server-actions-key")
    .digest("base64")
    .slice(0, 32);
}

const nextConfig: NextConfig = {
  // Prevent Next.js from attempting to bundle TypeORM for server chunks
  serverExternalPackages: ["typeorm"],
  
  turbopack: {},
  
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Treat typeorm as an external CommonJS module on the server
      config.externals = config.externals || [];
      config.externals.push({
        typeorm: "commonjs typeorm",
      });
    }

    // Suppress "Critical dependency: the request of a dependency is an expression" warnings
    config.module = {
      ...config.module,
      exprContextCritical: false,
    };

    return config;
  },
};

export default nextConfig;
```

---

## 4. DataSource Singleton & Thundering Herd Protection (`database/data-source.ts`)

In Next.js App Router:
1. Server requests execute concurrently in parallel async tasks.
2. During development, Fast Refresh (HMR) re-evaluates modules frequently.
3. If multiple incoming requests call `dataSource.initialize()` simultaneously, an unhandled race condition (`Cannot initialize DataSource because it is already initializing`) or multiple opened connection pools will occur.

Use the singleton instance + initialization promise mutex pattern:

```ts
import "reflect-metadata";
import { DataSource, type DataSourceOptions } from "typeorm";
import { Application } from "./entities/Application.entity";
import { Group } from "./entities/Group.entity";
import { SystemMessage } from "./entities/SystemMessage.entity";
import { seedDatabase } from "./seeds";

/**
 * Creates DataSourceOptions dynamically from validated server environment variables.
 * Explicit entity array is required for Next.js bundler compatibility.
 */
const createDataSourceOptions = (): DataSourceOptions => {
  const databaseUrl = process.env.DATABASE_URL;

  // MongoDB configuration example
  if (databaseUrl) {
    return {
      type: "mongodb",
      url: databaseUrl,
      synchronize: process.env.DB_SYNCHRONIZE === "true",
      logging: process.env.DB_LOGGING === "true",
      entities: [Application, Group, SystemMessage], // MUST BE EXPLICIT
    };
  }

  // Fallback / PostgreSQL example
  return {
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "app_status",
    synchronize: process.env.NODE_ENV !== "production",
    logging: process.env.DB_LOGGING === "true",
    entities: [Application, Group, SystemMessage], // MUST BE EXPLICIT
  };
};

// Base uninitialized DataSource instance
const AppDataSource = new DataSource(createDataSourceOptions());

// Singleton connection states preserved across Next.js dev HMR reloads
const globalForTypeORM = globalThis as unknown as {
  dataSourceInstance?: DataSource;
  dataSourceInitializationPromise?: Promise<DataSource> | null;
};

let dataSourceInstance: DataSource | null =
  globalForTypeORM.dataSourceInstance ?? null;
let dataSourceInitializationPromise: Promise<DataSource> | null =
  globalForTypeORM.dataSourceInitializationPromise ?? null;

/**
 * Retrieves the initialized singleton DataSource.
 * Uses a shared promise mutex to prevent concurrent initialization (thundering herd)
 * and attaches to globalThis to survive development Fast Refresh / HMR reloads.
 */
export const getDataSource = async (): Promise<DataSource> => {
  if (!dataSourceInstance) {
    dataSourceInstance = AppDataSource;
    if (process.env.NODE_ENV !== "production") {
      globalForTypeORM.dataSourceInstance = dataSourceInstance;
    }
  }

  // Return immediately if already connected
  if (dataSourceInstance.isInitialized) {
    return dataSourceInstance;
  }

  // If another request is currently initializing the connection, await the same promise
  if (dataSourceInitializationPromise) {
    return dataSourceInitializationPromise;
  }

  // Start initialization and store the active promise
  dataSourceInitializationPromise = (async () => {
    try {
      console.log("[Database] Initializing TypeORM DataSource connection...");
      await dataSourceInstance!.initialize();
      console.log("[Database] TypeORM DataSource successfully connected.");

      // Run idempotent seeds on first initialization if needed
      await seedDatabase(dataSourceInstance!);

      return dataSourceInstance!;
    } catch (error) {
      // Reset promise on failure so subsequent attempts can retry
      dataSourceInitializationPromise = null;
      if (process.env.NODE_ENV !== "production") {
        globalForTypeORM.dataSourceInitializationPromise = null;
      }
      console.error("[Database] Failed to initialize TypeORM DataSource:", error);
      throw error;
    }
  })();

  if (process.env.NODE_ENV !== "production") {
    globalForTypeORM.dataSourceInitializationPromise = dataSourceInitializationPromise;
  }

  return dataSourceInitializationPromise;
};
```

---

## 5. Startup Hooks with `instrumentation.ts`

Next.js provides `instrumentation.ts` to run code once when the Node.js server starts. This is ideal for background tasks (schedulers, health monitors) that rely on database connections.

```ts
/**
 * instrumentation.ts
 * Automatically loaded by Next.js on server startup.
 */
export async function register() {
  // Only execute in the Node.js runtime (not Edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // CRITICAL: Prevent executing background jobs during static build phase (`next build`)
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return;
    }

    console.log("[Instrumentation] Registering server services...");

    // Dynamically import services to avoid loading DB drivers at instrumentation parse time
    const { statusUpdateScheduler } = await import("./lib/scheduler/status-update-scheduler");

    // Start background scheduler
    statusUpdateScheduler.start();

    console.log("[Instrumentation] Server services registered successfully.");
  }
}
```

### Key Rules for Next.js Setup:
- **Never use string glob patterns** in `entities: ["src/entities/*.ts"]`. Always import classes explicitly: `entities: [User, Account]`.
- **Never initialize database connections during `next build`** unless your build environment has a guaranteed reachable database for static site generation.
- **Always gate background workers** behind `process.env.NEXT_RUNTIME === "nodejs"`.

