# Port/Adapter (Hexagonal) Architecture — Node.js + Fastify + TypeScript (Functional)

This memory describes how the AI agent should structure backend services using the **Port/Adapter (Hexagonal)** pattern in a **Node.js + Fastify + TypeScript** stack, using **functions instead of classes**.

The main goals:

- Keep **domain logic** independent from frameworks, databases, and transports.
- Use **pure functions**, **dependency injection**, and **small composable modules**.
- Make it easy to **swap adapters** (HTTP, DB, etc.) without changing the domain.

---

## Folder Structure (example)

Use a clear separation between **domain** and **adapters**:

    src/
      domain/
        trades/
          trades.entities.ts                 // domain entities
          trades.ports.ts                    // domain ports (interfaces)
          *-trades.usecase.ts                // use case (factory-based, functional)
          errors.ts                         // domain-specific error helpers
      adapters/
        http/
          trades.http.ts                     // Fastify HTTP adapter (inbound)
        persistence/
          tradeRepository.inMemory.ts     // in-memory repo (outbound adapter)
          tradeRepository.pg.ts            // db-backed repo (outbound adapter, optional)
      config/
        appDeps.ts                         // dependency wiring / composition root
      server.ts                             // Fastify server setup

**Rules:**

- Nothing inside `src/domain` should import Fastify, DB libraries, or env/config.
- Frameworks and IO live in `src/adapters` and `src/server.ts`.
- Wiring and object graphs live in `src/config`.

---

## Naming Conventions

### Domain Types & Entities

- Use *noun* names for domain types and entities:
  - `TradeCalculation`, `TradeCalculationId`, `Currency`, `TradeCalculationStatus`
- File naming:
  - `tradeCalculation.entity.ts` — domain *noun* concepts and entities
  - `errors.ts` — domain error helpers and types

### Ports (Interfaces / Contracts)

- Use *noun* or *noun phrase* with `Port` suffix:
  - `TradeCalculationRepositoryPort`, `AccountEquityPort`
- Define all domain ports in `*.ports.ts` files:
  `tradeCalculation.ports.ts` — contains `TradeCalculationRepositoryPort`

**Ports represent *what* the domain needs, described as *nouns*, not *how* they’re implemented.**

---

### Use Cases (Application Services)

- Use *verb phrase* names for use-case types:
  - `CreateTradePreview`, `GetSettings`
- Use *verb* `make*` prefix for factory functions that create use cases:
  - `makeCreateTradePreview`
  - `makeGetSettings`
- File naming:
  `createTradePreview.usecase.ts`
  `getSettings.usecase.ts`

**Pattern:**

- *Verb phrase* type for the use case, e.g. `CreateTradePreviewUseCase`.
- *Verb* factory that builds it, `makeCreateTradePreview(deps)`.

---

### Functions & Helpers

- Use *verb* or *verb phrase* for all functions:
  - `createTradePreview`, `getSettings`, `mapDomainErrorToHttp`
- For factories, always prefix with the *verb* `make`:
  - `makeInMemoryTradeCalculationRepository`
  - `makePgTradeCalculationRepository`
- For mapping between domain and DTOs, use *verb* names like `to*` / `from*`:
  - `toTradeCalculationResponse`
  - `fromRequestBodyToCreateTradeCalculationInput`

This keeps behavior as *verbs* and data as *nouns*.

---

### Adapters

#### HTTP Adapters

- File naming: `*.http.ts` for HTTP-related inbound adapters:
  - `trade.http.ts`
- Export a Fastify plugin factory (function-based, not class-based):
  - `tradeHttpPlugin(deps)`

**Responsibilities:**

- Parse HTTP request data into domain input types.
- Call use cases (`CreateTradeCalculationUseCase`, `GetSettingsUseCase`).
- Map domain results and domain errors to HTTP responses.

#### Persistence Adapters

- File naming:
  `tradeCalculationRepository.inMemory.ts`
  `tradeCalculationRepository.pg.ts`
- Export DI factories using *verb* `make*`:
  - `makeInMemoryTradeCalculationRepository`
  - `makePgTradeCalculationRepository`

Each adapter returns an object implementing the relevant *Port* (e.g. `TradeCalculationRepositoryPort`).

---

### Configuration / Wiring

- Use *verb* `build*` or `create*` for composition root functions:
  - `buildAppDeps` — assembles repositories and use cases into a dependency graph.
  - `buildServer` — creates and configures the Fastify instance.

Types for dependency graphs and configuration should be *nouns*:

- `AppDeps`, `ServerConfig`, `TradeCalculationDeps`

---

## Architectural Rules

1. **Domain Layer (`src/domain`)**

   - Contains:
     - *Noun* domain types (`TradeCalculation`, `TradeCalculationId`, `Currency`, etc.).
     - *Noun* ports (`TradeCalculationRepositoryPort`).
     - *Verb phrase* use cases (`CreateTradeCalculationUseCase`, `GetTradeCalculationUseCase`), built using *verb* factories like `makeCreateTradeCalculation`.
     - Domain-specific error helpers (`TradeCalculationNotFoundError`, `EntryPricePositiveError`, `DueDateInPastError`).

   - Must not:
     - Import Fastify.
     - Import database libraries.
     - Import configuration/env modules.

2. **Adapters Layer (`src/adapters`)**

   - HTTP adapters:
     - Define Fastify routes (e.g. `POST /trades`, `GET /trades/:id`).
     - Map HTTP DTOs to domain inputs and vice versa.
     - Translate domain errors into HTTP status codes.

   - Persistence adapters:
     - Implement ports like `TradeCalculationRepositoryPort`.
     - Use concrete storage technologies (in-memory, Postgres, etc.).

3. **Config Layer (`src/config`)**

   - Functions like `buildAppDeps`:
     - Create instances of repositories (e.g. `makeInMemoryTradeCalculationRepository`).
     - Create use cases via factories (`makeCreateTradeCalculation`, `makeGetSettings`).
     - Group them into `AppDeps` for consumption by the HTTP server.

4. **Server (`src/server.ts`)**

   - Builds the Fastify instance with `buildServer`.
   - Registers HTTP plugins, injecting use cases from `AppDeps`.
   - Starts listening on configured host/port.

---

## Coding Style (Functional, TypeScript)

- Prefer **pure functions** for all domain logic:

  - Example shape:
    
        const makeCreateTradeCalculation = (deps) => async (input) => {
          // pure rules + injected side effects (repo, now, id)
        };

- Inject side effects via dependencies (`deps`):

  - `now: () => Date`
  - `tradeCalculationRepository: TradeCalculationRepositoryPort`

- Use **TypeScript interfaces and types**, not classes or decorators.

- Keep `async` side effects at the edges (adapters), while domain logic is deterministic and easily testable.

---

## Error Handling

- Domain errors are plain `Error` objects augmented with a typed `code`:

  - `TradeCalculationNotFoundError` → code `TRADE_CALCULATION_NOT_FOUND`
  - `PricePositiveError` → code `PRICE_NOT_POSITIVE`

- HTTP adapter maps domain error codes to responses:

  - `TRADE_CALCULATION_NOT_FOUND` → HTTP 404
  - `PRICE_NOT_POSITIVE` → HTTP 400
  - Any other error → HTTP 500 (generic server error)

The mapping is handled by a *verb* function like `mapDomainErrorToHttp`.

---

## Testing Preferences

- **Domain tests:**
  - Use simple fake or in-memory implementations of `TradeCalculationRepositoryPort`.
  - Test use-case functions returned by `makeCreateTradeCalculation` and `makeGetSettings` directly.

- **Adapter tests:**
  - Stub use cases with small functions.
  - Test HTTP behavior (status codes, response body shapes, error mapping) using Fastify’s inject API.

---

## Summary for the AI Agent

- Separate **domain** (*nouns* and pure logic) from **adapters** (*verbs* interacting with external systems).
- Use *noun* names for data structures and ports, *verb* names for functions and behaviors.
- Implement all behavior as **pure functions with dependency injection** (`make*` factories).
- Keep Hexagonal boundaries:
  - Domain: no frameworks.
  - Adapters: implement ports with concrete tech.
  - Config + server: wire everything together.
