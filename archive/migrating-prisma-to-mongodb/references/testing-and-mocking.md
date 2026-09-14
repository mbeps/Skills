# Testing & Mocking MongoDB Repositories

This guide covers testing Next.js applications migrated from Prisma to a native MongoDB Data Access Layer using Vitest and Jest.

---

## 1. Mocking Repositories vs Mocking Prisma

When using Prisma, tests often construct elaborate mocks for `$transaction`, model delegators (`prisma.user.findUnique`), and relational inclusions.

With a repository pattern, mock high-level repository methods directly:

```typescript
// __tests__/actions/getUser.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUserRepository } = vi.hoisted(() => ({
  mockUserRepository: {
    findById: vi.fn(),
    findByEmail: vi.fn(),
  },
}));

vi.mock("@/db/repositories/user-repository", () => ({
  userRepository: mockUserRepository,
}));

import getUserById from "@/actions/user/get-user-by-id";

describe("getUserById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user data when user exists", async () => {
    const user = { id: "u-1", name: "Alice", email: "alice@test.com" };
    mockUserRepository.findById.mockResolvedValue(user);

    await expect(getUserById("u-1")).resolves.toEqual(user);
    expect(mockUserRepository.findById).toHaveBeenCalledWith("u-1");
  });
});
```

---

## 2. The Hoisting Trap in Vitest

### The Error
```text
FAIL  __tests__/actions/getUsers.test.ts
ReferenceError: Cannot access 'mockUserRepository' before initialization
```

### Cause
Vitest hoists all `vi.mock()` calls to the very top of the module before any other variables are evaluated. Referencing a top-level `const mockRepo = { ... }` inside the `vi.mock` factory fails because `mockRepo` is not yet defined at module load time.

### Solution: `vi.hoisted()`
Wrap mock objects in `vi.hoisted()`. Vitest executes `vi.hoisted` before any hoisted `vi.mock` callbacks:

```typescript
// ❌ FAILS with ReferenceError:
const mockUserRepository = { findById: vi.fn() };
vi.mock("@/db/repositories/user-repository", () => ({
  userRepository: mockUserRepository,
}));

// ✅ PASSES:
const { mockUserRepository } = vi.hoisted(() => ({
  mockUserRepository: { findById: vi.fn() },
}));
vi.mock("@/db/repositories/user-repository", () => ({
  userRepository: mockUserRepository,
}));
```

---

## 3. Testing the Database Client Singleton

When testing `utils/db/client.ts`, preserve real `ObjectId` functions while replacing `MongoClient` with a mock instance:

```typescript
// __tests__/utils/db/client.test.ts
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, MockMongoClient, mockMongoClientInstances } = vi.hoisted(() => {
  const instances: Array<Record<string, unknown>> = [];
  const db = {
    collection: vi.fn((name: string) => ({ name })),
  };
  const client = vi.fn(function (this: Record<string, unknown>, url: string) {
    this.url = url;
    this.db = vi.fn(() => db);
    instances.push(this);
  });
  return {
    mockDb: db,
    MockMongoClient: client,
    mockMongoClientInstances: instances,
  };
});

vi.mock("mongodb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mongodb")>();
  return {
    ...actual,
    MongoClient: MockMongoClient,
  };
});

describe("utils/db/client", () => {
  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as any)._mongoClient;
  });

  it("caches the client in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { mongoClient } = await import("@/utils/db/client");

    expect(MockMongoClient).toHaveBeenCalledTimes(1);
    expect((globalThis as any)._mongoClient).toBe(mongoClient);
  });

  it("converts hex strings to ObjectId with toObjectId", async () => {
    const { toObjectId } = await import("@/utils/db/client");
    const hex = "507f1f77bcf86cd799439011";

    const converted = toObjectId(hex);
    expect(converted).toBeInstanceOf(ObjectId);
    expect(converted.toString()).toBe(hex);
  });
});
```

