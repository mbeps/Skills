# Codebase Explanation: Diagrams and Flow Templates

Use these Mermaid templates to visually explain system architectures, runtime relationships, and execution sequences.

## 1. Top-Level System Topology

Show client runtimes, edge proxies, server layers, database systems, and external service boundaries.

```mermaid
graph TB
    subgraph Client ["Client Layer"]
        UI["UI Components"]
        State["State Stores / Hooks"]
    end

    subgraph Edge ["Edge / Ingress Layer"]
        Proxy["Proxy / Middleware Router"]
    end

    subgraph Server ["Server Runtime"]
        RSC["Server Components"]
        Actions["Server Actions / Endpoints"]
        Mappers["Domain Mappers / Services"]
    end

    subgraph External ["External Infrastructure"]
        Auth["Auth Service"]
        DB[("Database")]
        Storage["Object Storage / CDN"]
    end

    UI --> State
    State -->|"HTTP / Mutation"| Proxy
    Proxy -->|"Enriched Ingress"| Server
    RSC --> Actions
    Actions --> Mappers
    Mappers --> DB
    Actions --> Storage
    Proxy --> Auth
```

## 2. Five-Stage Pipeline Sequence

Trace end-to-end request cycles using structured sequence diagrams.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Router as 1. Routing (Pages/Proxy)
    participant Auth as 2. Middleware & Auth
    participant Logic as 3. Service Layer (Actions/Schemas)
    participant Data as 4. Data Access (DB/Storage)
    participant Out as 5. Response & Serialization

    User->>Router: Triggers action / route
    Router->>Auth: Validates session tokens
    Auth-->>Router: Context / User ID
    Router->>Logic: Executes validated domain action
    Logic->>Logic: Validates payload with schema
    Logic->>Data: Queries or updates persistent tables
    Data-->>Logic: Returns database records
    Logic->>Out: Maps records to domain models
    Out-->>User: Returns serialized response or UI update
```

## 3. Asynchronous Streaming / Media Flow

Use for media playback, event-driven streams, or background processing.

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Controller as Playback Controller
    participant Store as State Store
    participant Storage as Object Storage / CDN

    Client->>Controller: Requests stream playback
    Controller->>Store: Updates active track identifier
    Controller->>Storage: Requests byte range (HTTP 206)
    Storage-->>Controller: Streams binary chunks
    Controller-->>Client: Plays audio through sound engine
```
