# Phase 1 – Domain & Data Model

## User
- **Fields**
  - `id: UUID`
  - `email: string` (nullable until full auth rolls out)
  - `displayName: string`
  - `createdAt: ISO8601 timestamp`
  - `updatedAt: ISO8601 timestamp`
- **Relationships**: One-to-one with `UserSettings`; one-to-many with `ConnectedAccount` and `TradeCalculation`.
- **Validation Rules**: UUID v4 only; display name 1–64 ASCII/UTF-8 chars; timestamps immutable except `updatedAt`.

## UserSettings
- **Fields**
  - `userId: UUID`
  - `riskPercent: Decimal(5,4)` (default 0.02)
  - `atrMultiplier: Decimal(4,2)` (default 1.5)
  - `dataFreshnessThresholdMs: integer` (default 2000)
  - `defaultSymbol: string` (enum of allowlisted symbols)
  - `defaultTimeframe: enum` (`15m`, `5m`, `1m`, etc.)
  - `rememberedMultiplierOptions: Decimal[]`
  - `createdAt`, `updatedAt`
- **Relationships**: Owned by `User`.
- **Validation Rules**: `riskPercent` in (0, 1]; `atrMultiplier` in [0.5, 3]; freshness threshold between 1000 and 5000 ms; multiplier options deduplicated and sorted.

## ConnectedAccount
- **Fields**
  - `id: UUID`
  - `userId: UUID`
  - `venue: enum` (`apex-omni` for launch)
  - `accountId: string`
  - `status: enum` (`linked`, `revoked`, `error`)
  - `lastEquity: Decimal(18,2)`
  - `lastSyncAt: ISO8601 timestamp`
  - `createdAt`, `updatedAt`
- **Validation Rules**: `accountId` must match venue format; `lastEquity ≥ 0`; status transitions: `linked → revoked|error`, `error → linked` after successful retry.

## TradeCalculation
- **Fields**
  - `id: UUID`
  - `userId: UUID`
  - `executionMethod: enum` (`execute-button`, future extensibility)
  - `executedAt: ISO8601`
  - `input: TradeInput (JSONB)`
  - `output: TradeOutput (JSONB)`
  - `marketSnapshot: MarketSnapshot (JSONB)`
  - `source: enum` (`live`, `manual`)
  - `createdAt: ISO8601`
- **Validation Rules**: Persist within 30-day retention window; `source` derived from snapshot context; `output.riskAmount ≤ input.accountSize * input.riskPercent`.

## DeviceCacheEntry (Expo)
- **Fields**
  - `id: string` (hash of calculation id)
  - `input: TradeInput`
  - `output: TradeOutput`
  - `executionMethod: enum` (`execute-button`)
  - `executedAt: ISO8601`
  - `syncedAt: ISO8601`
  - `dirty: boolean`
- **Validation Rules**: Keep most recent 20 per device; purge entries older than 30 days once successfully synced; mark entries dirty until server acknowledgement arrives.

## DTOs (Non-Persisted)
- **MarketSnapshot**: `symbol`, `lastPrice`, `atr13`, `atrMultiplier`, `bid`, `ask`, `stale`, `source`, `serverTimestamp`.
- **TradeInput**: `symbol`, `direction`, `accountSize`, `entryPrice`, `stopPrice` (nullable when `useVolatilityStop` is true), `targetPrice`, `riskPercent`, `atrMultiplier`, `useVolatilityStop`, `timeframe`, `accountEquitySource`, `createdAt`.
- **TradeOutput**: `positionSize`, `positionCost`, `riskAmount`, `riskToReward`, `suggestedStop`, `warningCodes`, `atr13`.

## Ephemeral Calculator State
- **RingBuffer**: per-symbol array of the most recent ticks needed for ATR (kept in memory, not stored in the Supabase PostgreSQL database). Resets on process restart and warm-starts from the latest bar snapshot.
- **Freshness FSM**: `live → stale → reconnecting → live`; manual price entry sets `manual` flag until stream resumes. Logged for audit but not persisted as a table.
- **Entry Override Flag**: boolean tracking whether the user has manually provided an entry price, pausing auto-follow until cleared.

---

This pared-down model satisfies constitutional requirements for auditability, risk control, and data freshness while avoiding premature infrastructure.
