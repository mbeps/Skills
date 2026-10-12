# Example: `.agents/project-details.md`

Below is a canonical example of `.agents/project-details.md` for a full-stack Next.js web application:

```markdown
---
description: Project-specific architectural details, system design decisions, and how components interact. Load when working on features that span multiple subsystems.
applyTo: '**/*'
---

# Project Details & Architecture

## 1. System Architecture & Subsystem Interactions
- **Branching Conversation Tree**: Treat chat state as a branching tree, not a flat list. Active thread leaf is tracked by `chat.currentLeafId`. Persisting any message must update `currentLeafId` to prevent orphaned threads.
- **Attachment Scoping**: Attachments bind to `message_id`, not `chat_id`. To fetch all attachments for a chat, query message IDs first, then retrieve attachments with `inArray(attachment.messageId, messageIds)`.
- **Tool Registration & Precedence**: External tools are registered before internal tools to prevent third-party integrations from shadowing core system tools.

## 2. State Management & Lifecycle
- **Streaming State Isolation**: Keep transient streaming chunks local to UI hooks. Pushing chunks into global state stores creates unnecessary re-renders.
- **Centralised Sign-Out Reset**: Sign-out flows must clear all in-memory client state in one coordinated handler (`resetClientState`), wiping entity stores, chat state, and provider caches.
- **Cache Invalidation Epochs**: Provider registry cache tracking uses generational counters to discard in-flight responses that resolve after an invalidation event.

## 3. Concurrency, Async Execution & Cancellation
- **Stream Abort Registry**: Background job cancellation checks step checkpoints but cannot stop an active HTTP stream. Maintain an in-memory `ChatAbortRegistry` (`Map<string, AbortController>`). Stopping a stream aborts the controller immediately.
- **Persistence Idempotency on Abort**: When client and server both attempt to persist a stopped message, use database-level idempotency (`onConflictDoNothing`) on message IDs to prevent primary key collision errors.

## 4. Security & Trust Boundaries
- **Trust Boundaries for Approvals**: Tool approvals must be validated server-side. The client payload is restricted to `{ approvalId, approved }`. The server verifies cryptographic approval secrets and retrieves the stored tool call from the database.
- **Tenancy and User Scoping**: Knowledge base queries, vector embeddings, and database mutations must be strictly scoped by `userId`. Cross-user data retrieval is a critical security defect.

## 5. Runtime & Framework Mechanics
- **AI SDK Symmetry**: AI SDK v7 requires that every `tool-call` part in message history has a corresponding `tool-result` part before sending prompts to models.
- **Dynamic Vector Partitions**: Partition vector collections dynamically by embedding dimension (e.g. `kb_chunks_${dimensions}`). Idempotently initialise collections and payload indexes on first write.
```

