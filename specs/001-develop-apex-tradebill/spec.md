# Feature Specification: Apex TradeBill (Trading Companion App)

**Feature Branch**: `001-develop-apex-tradebill`  
**Created**: 2025-09-25  
**Status**: Draft  
**Input**: User description: "Develop Apex TradeBill, a trading companion app for Apex Omni DEX day traders. The app’s purpose is to provide a fast, portable, and reliable way to calculate position sizing, manage trade risk, and evaluate trade opportunities directly from a mobile device. Its core function is to let traders enter a potential trade idea and instantly see the calculated risk, required position size, and risk-to-reward profile, all powered by live market data. When a user launches Apex TradeBill, they will be prompted to enter or select key trade inputs: account size, trade direction (long or short), entry price, stop price, and target price. The entry price will default to the real-time trade value fetched from the API. Additional risk parameters such as multipliers, and percent risk can be configured upfront or adjusted through a settings menu. Crucially, the app will calculate the Average True Range (ATR) dynamically using real-time price data pulled directly from the Apex Omni API to determine a safe place to put stop losses to avoid being stop hunted or stopped out of a trade due to a tight stop loss. Default multiplier setting is 1.5. For a more conservative stop loss use 2 and for a tighter stop loss use 1. This ensures that all volatility-based calculations are current and adapt automatically as market conditions change. Based on the user’s inputs and live market data, the app will display critical trade outputs in real time. These include the number of crypto to buy, the total cost of the position, the trade’s exact risk value, and a clear risk-to-reward profile. The main interface will present this information in a structured, intuitive layout: Inputs Panel for entering trade details, Outputs Panel showing calculated trade size, cost, and risk, Risk Visualization to illustrate stop-loss versus target scenarios, and Trade History to store and review recent calculations. The rationale behind Apex TradeBill is to eliminate the friction of relying on static tools and manual calculations in fast-moving markets. By combining instant risk management calculations with real-time volatility analysis, the app gives traders sharper decision-making power at the moment of opportunity. In its initial phase, Apex TradeBill will focus on delivering feature parity for essential trade preparation functions—ensuring accuracy and speed—before expanding to advanced features such as multi-leg trades, saved strategies, or execution integrations."

## Execution Flow (main)
```
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identify: actors, actions, data, constraints
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   → Each requirement must be testable
   → Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   → If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   → If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies  
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## Clarifications

### Session 2025-09-25
- Q: What live update cadence should the app use for market data and recalculations? → A: Streamed price feed; recompute every 1s
- Q: What data freshness threshold marks live data as stale, and what fallback should occur? → A: Stale after 2s; auto-reconnect (1s→2s→5s); show “Stale” badge; allow manual entry
- Q: Source of account equity for risk % calculations? → A: Prefer connected account feed; fall back to manual when unavailable
- Q: Default ATR timeframe when the user has not explicitly selected a chart interval? → A: Remember last used; first-run default 15m
- Q: When multiple ticks arrive within a 1s window, which price should calculations use? → A: Latest tick at 1s boundary

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a day trader, I want to quickly input a trade idea (account size, direction, entry, stop, target) and immediately see position size, risk, and risk‑to‑reward based on live market data so that I can decide and act with confidence.

### Acceptance Scenarios
1. Given live market data is available and the user enters account size, direction, entry, stop, target, and risk %, When the user confirms inputs, Then the app displays position size, position cost, absolute risk amount, and risk‑to‑reward in real time.
2. Given the user has not entered an entry price, When the app fetches the current trade price, Then the entry field defaults to the current price and all outputs update accordingly.
3. Given a volatility‑based stop calculation is enabled with a default multiplier, When the user selects a conservative or tighter multiplier, Then the suggested stop and computed position size update consistently with the new risk distance.
4. Given inputs are invalid (e.g., stop not consistent with direction, zero/negative account size), When the user attempts to calculate, Then the app blocks calculation and shows clear validation messages.
5. Given live data becomes temporarily unavailable, When the user opens the app or updates inputs, Then the app informs the user and allows manual entry of price with clearly marked fallback.
6. Given the user is signed in and the connected trading account provides equity, When the app loads, Then the account size is auto-populated from that equity and clearly labeled; if the connection is unavailable, the user enters account size manually.
7. Given multiple ticks arrive within a 1s window, When the 1s recompute boundary is reached, Then the latest tick within that window is used for calculations; if no tick in the window, carry forward the last price and apply staleness rules.

### Edge Cases
- Extremely high volatility: suggested stop exceeds acceptable distance; app must still compute and warn user.
- Very small account size or very tight stop: computed position size rounds to zero or minimum lot; app must display a clear constraint message.
- Direction mismatch: stop/target on wrong side of entry for long/short; validation must prevent calculation until corrected.
- Data staleness: if market snapshot is older than the freshness threshold (2 s), the app must surface a “Stale” badge, attempt auto-reconnect with 1 s→2 s→5 s backoff, prompt users to refresh, and allow clearly marked manual price entry.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST allow input of account size, trade direction (long/short), entry price, stop price, target price, percent risk, and volatility multiplier.
- **FR-002**: System MUST default the entry price to the current market price when live data is available.
- **FR-003**: System MUST compute position size such that maximum loss does not exceed configured percent risk given stop distance.
- **FR-004**: System MUST compute and display absolute risk amount (in account currency) for the trade.
- **FR-005**: System MUST compute and display risk‑to‑reward ratio based on entry, stop, and target.
- **FR-006**: System MUST provide a volatility‑based suggested stop distance derived from live price dynamics with a configurable multiplier (default 1.5; common alternatives 1.0 and 2.0).
- **FR-007**: Users MUST be able to configure percent risk and volatility multiplier via settings and adjust them from the main flow.
- **FR-008**: System MUST update all outputs in real time as inputs change without disrupting control positions.
- **FR-009**: System MUST provide an at‑a‑glance risk visualization showing entry, stop, and target with relative distances.
- **FR-010**: System MUST persist a recent trade calculation history (inputs and outputs) for quick recall and review.
- **FR-011**: Inputs MUST be validated for presence, ranges, and logical consistency (e.g., long: target > entry > stop; short: target < entry < stop).
- **FR-012**: On data unavailability, the app MUST fail gracefully and allow manual price input with clear indication of non‑live data.
- **FR-013**: System MUST present numbers with locale‑aware formatting and accessible contrast that meets WCAG 2.1 AA (≥4.5:1) and honours system font scaling up to 200%.
- **FR-014**: System MUST provide a clear settings panel to manage defaults (risk %, multiplier, data freshness threshold).
- **FR-015**: System MUST meet the performance and reliability targets defined in this specification.
- **FR-016**: System MUST protect user secrets and sensitive tokens; no sensitive information appears in logs or UI.
- **FR-017**: Volatility measure is Average True Range (ATR) using Wilder's RMA smoothing. ATR lookback is 13 bars. The chart timeframe determines the bars used. Stop distance = multiplier × ATR(13, RMA) at the current bar/timeframe. Default timeframe selection remembers the last used interval; on first run, default to 15 minutes (15m).
- **FR-018**: Default percent risk is 2% of account equity per trade (configurable).
- **FR-019**: Supported symbols/universe (ApeX Omni):
  - Use the trading venue’s official symbol catalogue for perpetual contracts.
  - Include only markets flagged as tradable and open for new positions; exclude prelaunch listings unless explicitly approved.
  - Launch allowlist: `BTC-USDT`, `ETH-USDT` (expandable via configuration without code changes).
  - Respect venue-specific naming for private trading actions (dash separator) and public market data (no separator).
  - Settlement: contracts settle in USDT per venue margin rules; display values in account currency with clear labeling.
  - Validation/precision: apply each symbol’s published tick size, step size, and minimum order size to input validation and rounding.
- **FR-020**: Trade history retention is 30 days; entries older than 30 days are pruned.
- **FR-021**: Rounding & precision (BTC-USDT default):
  - Position size: floor to 0.000001 BTC (1e-6) to ensure risk is not exceeded; if symbol metadata specifies a stricter lot size, apply that instead.
  - Price fields (entry/stop/target): round to $0.01 (or the symbol's tick size if provided).
  - Monetary amounts (position cost, risk amount): round half up to the nearest cent ($0.01).
  - Ratios (risk-to-reward): round to 2 decimal places.
- **FR-022**: Live market feed: refresh calculated outputs at least once every 1 second whenever the venue reports new prices.
- **FR-023**: Data freshness and fallback: mark data stale after 2 seconds without an update; display a “Stale” badge; attempt reconnects with backoff (1s→2s→5s); permit manual price entry during staleness.
- **FR-024**: Account equity source for risk %: prefer the connected trading account’s reported equity when available; otherwise require manual account size input. Clearly indicate the source (Connected or Manual) and recompute when the source or value changes.
- **FR-025**: Price sampling rule: when multiple prices arrive within a 1-second window, use the latest price at the refresh boundary. If no price arrives in the window, carry forward the last known price and apply FR-023 staleness behavior.
- **FR-026**: System MUST cache the most recent trade calculations locally for offline review and sync them to server history within 30 days once connectivity resumes.

### Performance & Reliability Targets
- Live price change to refreshed outputs: median ≤ 250 ms; 95th percentile ≤ 500 ms on the reference mid-tier mobile device and network.
- Screen interactions maintain at least 55 frames per second for 95% of interactive sessions measured over 5-minute windows.
- Automatic reconnect succeeds within 5 seconds for at least 99% of transient data interruptions during trading hours.
- Core calculation features remain available for 99.5% of trading hours each week, excluding scheduled maintenance windows communicated in advance.

### Key Entities *(include if feature involves data)*
- **TradeInput**: user‑provided parameters (account size, direction, entry, stop, target, risk %, multiplier, timestamp, symbol).
- Update: Account size may be auto-populated from connected account equity when available; the interface must indicate whether the value is Connected or Manual.
- **MarketSnapshot**: symbol, price, timestamp, volatility signal (with freshness metadata).
- **TradeOutput**: position size (units), position cost, risk amount, risk‑to‑reward, suggested stop.
- **TradeCalculation**: persisted combination of TradeInput + TradeOutput for history display.
- **User**: authenticated trader profile including role metadata and audit preferences.
- **UserSettings**: configurable defaults (risk %, multiplier, data freshness threshold) with provenance (manual vs connected account).
- **ConnectedAccount**: representation of the linked Apex Omni account, including equity snapshots and connection state for labeling.
- **DeviceCacheEntry**: device-local cache entry capturing the last calculations and sync status for offline resilience.

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous  
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified
- [ ] Property-based tests defined for ATR and sizing formulas

### Constitution Alignment
- [x] Data integrity and risk management needs captured (if applicable)
- [x] Performance budgets and reliability targets specified
- [x] Security and secrets handling requirements included

---

## Execution Status
*Updated by main() during processing*

- [ ] User description parsed
- [ ] Key concepts extracted
- [ ] Ambiguities marked
- [ ] User scenarios defined
- [ ] Requirements generated
- [ ] Entities identified
- [ ] Review checklist passed

---
