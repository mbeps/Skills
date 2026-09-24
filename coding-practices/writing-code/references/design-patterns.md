# Pragmatic Design Patterns & Refactoring

Design patterns are reusable solutions to recurring architectural challenges. However, **patterns are not goals in themselves**. Applying design patterns prematurely or dogmatically creates cognitive friction, interface bloat, and "architecture astronaut" codebases.

**Governing Rule:** Default to the simplest concrete function or data structure. Apply formal patterns only when concrete variations (the **Rule of Three**), combinatorial explosion, or boundary isolation demand them. While abstraction is valuable for decoupling and managing real variation, **never over-abstract**: excessive abstraction makes codebases needlessly complex and difficult to trace. **Around 3–4 layers of abstraction should be the absolute limit** (e.g. Route/UI → Service → Repository/Gateway → Database/Client).

---

## Pattern Matrix & YAGNI Sanity Checks

| Pattern                                            | Solves                                                                                             | YAGNI Sanity Check & Boundary                                                              | When NOT to Use                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **Composition over Inheritance** (Bridge/Delegate) | Subclass explosion when entities vary across multiple orthogonal axes (e.g. format × destination). | Use when inheritance requires $M \times N$ subclasses or rigid base-class overrides.       | Single variation axis or simple class extension.                             |
| **Strategy**                                       | Monolithic conditional chains (`if/switch`) that must frequently absorb new business algorithms.   | Use when 3+ algorithmic variations exist or rules change independently of the coordinator. | Simple 2-way branching or static, unchanging logic.                          |
| **Adapter / Gateway**                              | Incompatible vendor SDKs, legacy interfaces, or third-party schema drift.                          | Use at the boundary of external services to isolate internal domain models.                | Wrapping stable language primitives or standard library functions.           |
| **Factory Function / Registry**                    | Complex object construction requiring polymorphic dispatch or validation logic.                    | Use when instantiation logic clutters consumers or needs dynamic lookup.                   | Trivial instantiation (`new Foo(a, b)`). Avoid Abstract Factory boilerplate. |

---

## 1. Composition Over Inheritance (Bridge / Delegate)

### The Problem: Subclass Explosion
Inheritance models a rigid "is-a" relationship. When a domain needs to vary along two or more dimensions (e.g. `Format: JSON, Text` and `Destination: File, Console`), inheritance forces a combinatorial explosion:
```java
// Anti-pattern: M * N classes
abstract class Logger {}
class ConsoleTextLogger extends Logger {}
class ConsoleJsonLogger extends Logger {}
class FileTextLogger extends Logger {}
class FileJsonLogger extends Logger {}
// Adding 1 destination + 1 format requires 5+ new classes
```

### The Solution: Composable Collaborators
Decouple the dimensions into focused, interchangeable interfaces injected at runtime ("has-a" relationship):

```typescript
// Focused role interfaces
interface LogFormatter {
  format(message: string): string;
}

interface LogDestination {
  write(formattedMessage: string): void;
}

// Composed orchestrator
class Logger {
  constructor(
    private readonly formatter: LogFormatter,
    private readonly destination: LogDestination,
  ) {}

  log(message: string): void {
    this.destination.write(this.formatter.format(message));
  }
}

// Instantiation: M + N classes, zero explosion
const logger = new Logger(new JsonFormatter(), new ConsoleDestination());
```

### Step-by-Step Refactoring: Inheritance to Composition
1. **Identify the axes of variation**: Find which base-class methods derived classes are constantly overriding.
2. **Extract interfaces**: Create single-responsibility interfaces for each varying capability.
3. **Turn subclasses into standalone implementations**: Convert child classes into independent components implementing those interfaces.
4. **Inject collaborators**: Pass the interface implementations into the base class constructor.
5. **Forward method calls**: Replace overridden methods in the base class with delegates to the injected collaborators.

---

## 2. Strategy Pattern

### The Problem: Monolithic Branching
When multiple filtering, calculation, or validation rules live in a single cascading `if/else` or `switch` block, every new requirement requires modifying and risking regression in tested code:

```typescript
// Anti-pattern: violates Open/Closed Principle
function calculateDiscount(user: User, amount: number): number {
  if (user.type === 'VIP') return amount * 0.2;
  if (user.type === 'SEASONAL' && isHoliday()) return amount * 0.15;
  if (user.ordersCount > 100) return amount * 0.1;
  return 0;
}
```

### The Solution: Encapsulated Strategies
Encapsulate each algorithm or rule behind a uniform contract. The coordinator executes applicable strategies without knowing their internal logic:

```typescript
interface DiscountStrategy {
  isApplicable(user: User): boolean;
  calculate(user: User, amount: number): number;
}

class VipDiscountStrategy implements DiscountStrategy {
  isApplicable(user: User): boolean { return user.type === 'VIP'; }
  calculate(_user: User, amount: number): number { return amount * 0.2; }
}

class DiscountCalculator {
  constructor(private readonly strategies: DiscountStrategy[]) {}

  calculate(user: User, amount: number): number {
    const matched = this.strategies.find((s) => s.isApplicable(user));
    return matched ? matched.calculate(user, amount) : 0;
  }
}
```

### YAGNI Check: The Rule of Three
- If there are only 1 or 2 static branches that rarely change, **keep the direct `if/else` or switch statement**.
- Only graduate to the Strategy pattern when you reach 3+ distinct variations, or when variations are added dynamically by different modules.

---

## 3. Adapter / Gateway Pattern

### The Problem: Vendor SDK Leaks
Directly using vendor-specific types, methods, and error classes throughout application code tightly couples your domain to third-party APIs.

### The Solution: Thin Domain-Centric Gateway
Wrap the external dependency behind a thin contract defined in terms of your application's domain vocabulary:

```typescript
// Domain contract
interface PaymentGateway {
  charge(customerId: string, amountCents: number): Promise<ChargeResult>;
}

// Adapter isolating external vendor SDK
class StripePaymentGateway implements PaymentGateway {
  constructor(private readonly stripeClient: Stripe) {}

  async charge(customerId: string, amountCents: number): Promise<ChargeResult> {
    try {
      const intent = await this.stripeClient.paymentIntents.create({
        customer: customerId,
        amount: amountCents,
        currency: 'usd',
      });
      return { success: true, transactionId: intent.id };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
```

### YAGNI Check
- Never wrap stable language built-ins or standard libraries (e.g. `Math`, `JSON`, standard date utilities).
- Only create adapters at real I/O and third-party boundaries where mockability or vendor isolation provides tangible return.

---

## 4. Tactical Refactoring Recipes

### Flattening Nested Logic with Guard Clauses
Deep nesting forces the reader to track multiple branches simultaneously. Invert preconditions using early returns:

```typescript
// Anti-pattern: Deep nesting
function processOrder(order: Order, user: User) {
  if (user.isActive) {
    if (order.items.length > 0) {
      if (order.total > 0) {
        return executePayment(order);
      } else {
        throw new Error('Order total must be positive');
      }
    } else {
      throw new Error('Order must contain items');
    }
  } else {
    throw new Error('User is inactive');
  }
}

// Clean architecture: Guard clauses
function processOrder(order: Order, user: User) {
  if (!user.isActive) throw new Error('User is inactive');
  if (order.items.length === 0) throw new Error('Order must contain items');
  if (order.total <= 0) throw new Error('Order total must be positive');

  return executePayment(order);
}
```

### Deconstructing the "Junk Drawer" (`utils.ts`)
Avoid creating catch-all utility files that bundle unrelated functions together.
- **Pure functions**: Group by mathematical/domain cohesion (`date-formatters.ts`, `string-transforms.ts`). Pure functions have no side effects and rely strictly on arguments.
- **Side effects**: Elevate to formal services or repository classes (`database-client.ts`, `auth-service.ts`). Do not hide network or database calls in a utility file.
- **Single-use helpers**: Colocate directly in the file or directory where they are consumed. Only centralise after proven reuse across 3+ distinct call sites.
