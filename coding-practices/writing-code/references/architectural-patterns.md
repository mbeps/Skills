# Pragmatic Decoupling: Event Bus, State Machines, & Boundaries

When code grows, coupling and state transitions become primary sources of bugs and rigidity. Architectural patterns such as **Event Buses** and **State Machines** offer powerful ways to decouple components and prevent invalid states.

However, like SOLID principles, **these patterns introduce indirection and must be applied selectively**. Misapplying them creates "architecture astronauts" codebases where simple workflows become impossible to trace. YAGNI must serve as the primary sanity check.

> **Note on Scope:** This guide covers high-level concepts, decision boundaries, and trade-offs when writing application code. Comprehensive framework implementations (e.g., enterprise message brokers, distributed Sagas, XState orchestration) warrant dedicated skills.

---

## 1. Event Bus & Pub-Sub (Domain Events)

### Concept
An Event Bus or Pub-Sub pattern decouples the **producer** of an event from one or more **consumers**. The producer announces that something happened (e.g., `OrderPaid`), and registered listeners react independently without the producer knowing who or what is listening.

```
Direct Coupling (Brittle):
[Order Service] ---> [Send Email]
                ---> [Update Inventory]
                ---> [Ping Analytics]
                ---> [Notify CRM]

Decoupled with Event Bus:
[Order Service] ---> Emits: "OrderPaid"
                          |
             +------------+------------+
             v            v            v
        [Mailer]     [Inventory]   [Analytics]
```

### When to Use
- **One-to-Many Side Effects:** A single action triggers 3+ independent reactions in different subsystems that do not affect the main transaction.
- **Cross-Domain Boundaries:** Decoupling distinct modules (e.g. Billing module should not directly import the Notification module).
- **Asynchronous Processing:** Operations that can be deferred or executed in the background without holding up the user-facing request.

### When NOT to Use (YAGNI & Anti-Patterns)
- **1-to-1 Calls:** If there is only one consumer for an event, an event bus adds indirection without benefit. **Call the function directly.**
- **Synchronous Request-Response:** If the caller immediately requires the result or must fail the transaction if the consumer fails, an event bus creates brittle, hidden coupling.
- **"Action at a Distance":** When event listeners trigger other events in a hidden cascade, debugging and reasoning about execution flow becomes a nightmare. If you cannot trace the code by following references, the architecture has become too loose.

---

## 2. State Machines (Finite State Machines / FSM)

### Concept
A State Machine formalises the explicit states an entity can occupy and the valid transitions between them. It replaces tangled collections of boolean flags with a single, unambiguous state representation.

```
                    +-------------+
                    |    Draft    |
                    +------+------+
                           | submit()
                           v
                    +-------------+
            +------>|  In Review  |-------+
            |       +------+------+       |
            | reject()     | approve()    | cancel()
            |              v              v
     +------+------+  +----+--------+ +---+--------+
     |   Changes   |  |  Published  | |  Cancelled |
     |  Requested  |  +-------------+ +------------+
     +-------------+
```

### When to Use
- **Boolean Flag Soup:** When an entity relies on multiple booleans (e.g. `isDraft`, `isSubmitting`, `isApproved`, `isRejected`, `isFailed`) where contradictory combinations are syntactically possible (e.g. `isDraft: true` AND `isApproved: true`).
- **Strict Transition Rules:** When an entity has a formal lifecycle (orders, payment workflows, deployment pipelines) where certain actions are only legal from specific states.
- **State-Dependent Invariants:** When fields are required only in certain states (e.g. `rejectionReason` is required if and only if state is `Rejected`). In TypeScript, model this using **discriminated unions**.

### When NOT to Use (YAGNI & Anti-Patterns)
- **Binary Toggles:** A simple `isEnabled: boolean` or `isOpen: boolean` does not need a state machine.
- **Linear Step-by-Step Logic:** Workflows with no branching, retries, or state rollbacks are simpler as a sequential async function.
- **Heavy FSM Overkill:** Do not import heavy state machine libraries (e.g. XState) when a simple enum with a switch statement or transition dictionary suffices for your domain.

---

## 3. Boundaries & Gateways (Ports & Adapters Lite)

### Concept
Keep external libraries, database drivers, and third-party APIs behind a clean, focused application boundary. Your domain logic should express operations in its own vocabulary, not the vendor's vocabulary.

### When to Use
- Interfacing with third-party APIs (Stripe, Twilio, SendGrid) that may change their schemas or SDKs.
- Interfacing with databases or filesystems to enable in-memory unit testing without mocking global network calls.

### When NOT to Use (YAGNI)
- Wrapping standard language utilities or stable libraries (e.g. `lodash`, `math`, standard date helpers).
- Creating wrapper classes that do nothing except pass parameters 1:1 to an internal method without adding domain clarity.

---

## Pattern Selection Matrix

| Scenario                               | Direct Solution (YAGNI default)         | Decoupled Pattern          | When to Graduate to Pattern                                                            |
| -------------------------------------- | --------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| Triggering an action in another module | Direct function call (`notifyUser(id)`) | Event Bus / Pub-Sub        | Multiple disparate modules need to react independently to the same domain event.       |
| Tracking entity progress               | 1-2 boolean flags (`isDone`)            | State Machine (enum / FSM) | 3+ states, illegal transition risks, or boolean flag soup emerging.                    |
| External vendor integration            | Direct library call in service          | Gateway / Adapter          | Logic is reused, needs unit testing without network, or vendor API is volatile.        |
| Multi-step business workflow           | Linear function with error handling     | Saga / State Machine       | Workflow spans long-running asynchronous steps, retries, or compensating transactions. |

---

## The YAGNI Sanity Check

Before adding an event bus, state machine, or abstraction layer, answer these three questions:

1. **Can I trace this in my editor?** If adding this pattern means "Find All References" or "Go to Definition" stops working, the indirection penalty is high. Is the decoupling worth that cost today?
2. **Am I solving a current bug or a future hypothetical?** If you are guarding against a state transition or variation that doesn't exist yet, defer until it does.
3. **Is the simplest version enough?** Can an enum and a switch statement do what an FSM library does? Can an array of listener functions do what an event broker does? If yes, choose the simpler version.
