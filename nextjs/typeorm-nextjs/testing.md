# Testing: Mocking TypeORM with Vitest

## 1. Why Mock TypeORM in Unit & Integration Tests?

Connecting to a live database during unit tests causes:
- Slow test suite execution (network roundtrips, disk I/O).
- Flaky tests due to shared state pollution when test files run in parallel.
- Complex CI setup requiring running Docker database containers for simple logic tests.

A robust mock architecture simulates `DataSource`, `Repository`, and `MongoRepository` with full in-memory control and transaction rollback verification.

---

## 2. Reusable Mock Repository Factory (`__tests__/helpers/mock-database.ts`)

```ts
import { vi } from "vitest";

/**
 * Creates an in-memory mock repository simulating TypeORM repository methods
 */
export const createMockRepository = () => {
  let storedItems: any[] = [];

  const repo = {
    find: vi.fn(async (options?: any) => [...storedItems]),

    findOne: vi.fn(async (options?: any) => {
      if (!options?.where) return storedItems[0] || null;
      // Simple property matcher for common queries
      const whereKeys = Object.keys(options.where);
      return storedItems.find((item) =>
        whereKeys.every((key) => item[key] === options.where[key])
      ) || null;
    }),

    findBy: vi.fn(async (where: any) => {
      const whereKeys = Object.keys(where);
      return storedItems.filter((item) =>
        whereKeys.every((key) => item[key] === where[key])
      );
    }),

    save: vi.fn(async (entity: any) => {
      const toSave = { ...entity };
      if (!toSave.id && !toSave._id) {
        toSave.id = `mock-id-${Date.now()}`;
      }
      const existingIdx = storedItems.findIndex(
        (i) => (i.id && i.id === toSave.id) || (i.coriaId && i.coriaId === toSave.coriaId)
      );
      if (existingIdx >= 0) {
        storedItems[existingIdx] = toSave;
      } else {
        storedItems.push(toSave);
      }
      return toSave;
    }),

    create: vi.fn((entityData: any) => ({ ...entityData })),

    update: vi.fn(async (criteria: any, partialEntity: any) => ({
      raw: [],
      affected: 1,
      generatedMaps: [],
    })),

    delete: vi.fn(async (criteria: any) => {
      const initialLength = storedItems.length;
      storedItems = storedItems.filter(
        (item) => item.id !== criteria && item.id !== criteria?.id
      );
      return { raw: [], affected: initialLength - storedItems.length };
    }),

    count: vi.fn(async () => storedItems.length),

    // Test inspection helper methods
    __setItems: (items: any[]) => {
      storedItems = [...items];
    },
    __getItems: () => [...storedItems],
    __clear: () => {
      storedItems = [];
    },
  };

  return repo;
};
```

---

## 3. Mock DataSource Factory (`__tests__/helpers/mock-datasource.ts`)

```ts
import { vi } from "vitest";
import { createMockRepository } from "./mock-database";

export const createMockDataSource = () => {
  const repositories = new Map<string, any>();
  const transactionHistory: Array<{ commit: boolean; rollback: boolean }> = [];
  let isInitialized = true;

  const getRepo = (entity: any) => {
    const entityName = typeof entity === "string" ? entity : entity.name;
    if (!repositories.has(entityName)) {
      repositories.set(entityName, createMockRepository());
    }
    return repositories.get(entityName);
  };

  return {
    isInitialized: vi.fn(() => isInitialized),
    initialize: vi.fn(async () => {
      isInitialized = true;
    }),
    destroy: vi.fn(async () => {
      isInitialized = false;
      repositories.clear();
    }),
    getRepository: vi.fn(getRepo),
    getMongoRepository: vi.fn(getRepo),

    // Transaction mock with commit/rollback recording
    transaction: vi.fn(async (callback: (manager: any) => Promise<any>) => {
      const transactionalManager = {
        getRepository: vi.fn(getRepo),
        getMongoRepository: vi.fn(getRepo),
      };

      try {
        const result = await callback(transactionalManager);
        transactionHistory.push({ commit: true, rollback: false });
        return result;
      } catch (error) {
        transactionHistory.push({ commit: false, rollback: true });
        throw error;
      }
    }),

    // Inspection helpers
    __getTransactionHistory: () => [...transactionHistory],
    __clearTransactionHistory: () => {
      transactionHistory.length = 0;
    },
    __reset: () => {
      repositories.forEach((repo) => repo.__clear && repo.__clear());
      transactionHistory.length = 0;
    },
  };
};
```

---

## 4. Testing Direct Queries & Server Actions in Vitest

Use `vi.hoisted()` to create the mock instance before module imports are resolved:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockDataSource } from "@/__tests__/helpers/mock-datasource";
import { Application } from "@/database/entities/Application.entity";

// 1. Hoist the mock DataSource instance
const { mockDataSource } = vi.hoisted(() => {
  return {
    mockDataSource: createMockDataSource(),
  };
});

// 2. Mock the data-source module
vi.mock("@/database/data-source", () => ({
  getDataSource: vi.fn(async () => mockDataSource),
}));

// 3. Import functions under test AFTER mocks are declared
import { queryDefaultApplications } from "@/lib/queries/application-queries";
import { updateApplicationAction } from "@/actions/applications/update-application";

describe("Application TypeORM Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDataSource.__reset();
  });

  describe("queryDefaultApplications", () => {
    it("should return default applications converted to DTOs", async () => {
      const appRepo = mockDataSource.getMongoRepository(Application);
      appRepo.find.mockResolvedValueOnce([
        {
          _id: "65123456789abcdef0123456",
          coriaId: "CORIA-100",
          applicationName: "Payments API",
          applicationStatus: "GREEN",
          default: true,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);

      const response = await queryDefaultApplications();

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(1);
      expect(response.data[0].id).toBe("65123456789abcdef0123456");
      expect(response.data[0].applicationName).toBe("Payments API");
    });

    it("should handle database connection errors gracefully", async () => {
      const appRepo = mockDataSource.getMongoRepository(Application);
      appRepo.find.mockRejectedValueOnce(new Error("Connection timeout"));

      const response = await queryDefaultApplications();

      expect(response.success).toBe(false);
      expect(response.error).toBe("Connection timeout");
    });
  });

  describe("updateApplicationAction (Server Action)", () => {
    it("should update application and return updated DTO", async () => {
      const appRepo = mockDataSource.getMongoRepository(Application);
      appRepo.findOne.mockResolvedValueOnce({
        _id: "65123456789abcdef0123456",
        coriaId: "CORIA-100",
        applicationName: "Old Name",
        default: false,
      });

      const response = await updateApplicationAction({
        coriaId: "CORIA-100",
        applicationName: "New Name",
        default: true,
      });

      expect(response.success).toBe(true);
      expect(appRepo.save).toHaveBeenCalledTimes(1);
      expect(response.data?.applicationName).toBe("New Name");
    });
  });
});
```

---

## 5. Testing Transactions

Verify that transactions properly commit or rollback when errors are thrown:

```ts
import { describe, it, expect, vi } from "vitest";
import { createMockDataSource } from "@/__tests__/helpers/mock-datasource";

describe("Transaction Integrity", () => {
  it("should record rollback when an error occurs during transaction execution", async () => {
    const mockDs = createMockDataSource();

    await expect(
      mockDs.transaction(async () => {
        throw new Error("Simulated failure inside transaction");
      })
    ).rejects.toThrow("Simulated failure inside transaction");

    const history = mockDs.__getTransactionHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual({ commit: false, rollback: true });
  });

  it("should record commit when transaction completes successfully", async () => {
    const mockDs = createMockDataSource();

    await mockDs.transaction(async () => {
      return "success";
    });

    const history = mockDs.__getTransactionHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual({ commit: true, rollback: false });
  });
});
```

