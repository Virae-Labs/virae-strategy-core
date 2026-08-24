# Musk tweet-count strategy

## At a glance and status

| Item | Contract |
| --- | --- |
| Strategy ID | `polymarket-musk-tweet-count` |
| Model / execution policy | `musk-live-v2` / version `2` |
| Primary API | `decideMuskTweetCountEntry` |
| Sleeves | Low-tail No, high-tail No, late directional Yes, lottery Yes, next-market No preposition |
| Output | One canonical generated or rejected candidate plus full current/next evaluations |

```ts
import {
  DEFAULT_MUSK_TWEET_STRATEGY_CONFIG,
  decideMuskTweetCountEntry,
} from '@viraeai/virae-strategy-core/musk-tweet-count';

const decision = decideMuskTweetCountEntry({
  currentSnapshot,
  nextSnapshot,
  config: DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry,
  nowSec,
});
```

The snapshots and explicit `nowSec` are host-provided. A selected intent is not a submitted order.

The Musk tweet-count module is the single decision implementation used by Polybot and local consumers. It accepts normalized market, XTracker counter, rate, and order-book snapshots; it performs no discovery, HTTP, database, wallet, or order-submission work.

## Snapshot contract

A coherent `MuskTweetSnapshot` contains market identity and time range, bucket definitions and YES/NO token IDs, a counter value/source/update timestamp/freshness assertion, 30m/60m/2h/6h/24h rate signals, event factor, remaining hours, and token-level orderbook quotes. A selected quote must have a tradable ask, fresh source, and available venue minimum size.

The host owns XTracker collection, clock comparison, market-range normalization, and confirmation that counter semantics match settlement rules. The package validates time fields and gates on supplied freshness booleans; it cannot prove upstream correctness.

## Public contract and deterministic priority

- `decideMuskTweetCountEntry` evaluates current and optional next markets and applies the canonical selection priority.
- `evaluateMuskTweetStrategy` exposes every current-market sleeve evaluation.
- `evaluateMuskTweetNextMarketPreposition` exposes the next-market sleeve evaluation.
- `selectMuskEvaluationSnapshots` selects the active market and earliest upcoming market.
- `resolveMuskTweetPersistentRiskStop` returns a pure task risk-stop reason.

Callers must pass `nowSec` for deterministic live decisions and replay. Intent IDs equal stable `intentKey` values derived from strategy, token, side, price, amount kind, and amount. The host must additionally namespace and deduplicate them by account, task, and market lifecycle.

Selection priority is: eligible next-market preposition, first eligible current-market sleeve, rejected next-market candidate, then first rejected current-market candidate. Current sleeves are evaluated in low-tail No, high-tail No, late directional Yes, and lottery Yes order. Rejected candidates are audit records and never authorize submission.

## Live budget and sleeve sizing

`DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry.maxNotionalUsd` is a **1,000 USD task-budget basis**, not an instruction to spend 1,000 USD on every order. With `B = maxNotionalUsd`, the default intent notionals are:

| Sleeve | Formula | Default amount |
| --- | --- | ---: |
| Low-tail No, normal | `B × 0.75 × 0.25` | 187.50 USD |
| Low-tail No, watch size | `B × 0.75 × 0.10` | 75.00 USD |
| High-tail No | `B × 0.75 × 0.15` | 112.50 USD |
| Late directional Yes | `B × 0.30 × 0.20` | 60.00 USD |
| Lottery Yes | `B × min(0.02, 0.05)` | 20.00 USD |
| Next-market preposition | `B × 0.30` | 300.00 USD |

Amounts are rounded to four decimal places. Every candidate must meet `minOrderNotionalUsd` and the venue-provided minimum share size. Polybot may replace `B` with a lower effective task bankroll or global cap before evaluation.

The default entry TTL is 45 seconds, minimum order notional is 1 USD, and deterministic-profit floor is 0.25 USD. Default signal windows include a 10-tweet low-boundary buffer, at most eight hours for high-tail No, two-to-four hours for late directional, burst thresholds of 3 tweets/30m or 8 tweets/60m, and an eight-hour upcoming-market window. Use `normalizeMuskTweetStrategyConfig` for bounded external configuration; persist the resulting values rather than only raw user input.

## Entry rules

### Low-tail No

Targets the exact `0–39` / `<40` range. It becomes state-eligible after the boundary is breached, within `lowTailBoundaryBufferTweets` while at least four hours remain, or as a smaller watch entry when count is below 30, at least eight hours remain, a burst is active, and ask is 0.90–0.94. Normal near-boundary asks must be inside `lowTailMinAsk`–`lowTailMaxAsk`. A breached range uses an ask cap of 0.995 and must satisfy `minExpectedProfitUsd`.

### High-tail No

Targets a range overlapping **90–114**; `115+` is explicitly excluded. Before breach, count must be below 65, remaining time must not exceed `highTailMaxRemainingHours`, and ask must be inside `highTailMinAsk`–`highTailMaxAsk`. A special-event factor blocks the pre-breach candidate. A breached range uses an ask cap of 0.995 and must satisfy `minExpectedProfitUsd`.

### Late directional Yes

Runs only between `directionalMinRemainingHours` and `directionalMaxRemainingHours`. Projected final count is current count plus remaining hours multiplied by the maximum adjusted 2h/6h/24h rate. Only a main 40–89 range is eligible, and its Yes ask must not exceed 0.72.

### Lottery Yes

Requires a burst event or a configured 30m/60m rate trigger. It considers Yes tokens for ranges beginning at 115 and requires an ask from 0.005 through 0.03. At most the first eligible far range is selected.

### Next-market preposition

For an upcoming market starting within `nextMarketPrepositionMaxHours`, it targets the 90–114 range No token. During the first 30 minutes after a market starts, it targets the `<40` No token. Ask must not exceed 0.97. Both current and next counter snapshots and the selected next-market orderbook must be fresh.

## Fail-closed inputs and blockers

Counter freshness and selected-orderbook freshness are mandatory. Missing asks, `source: UNAVAILABLE`, stale quotes, unavailable market minimum size, below-minimum notional/shares, malformed timestamps, and strategy price/state gates block entry.

Malformed input produces `INVALID_INPUT` at selector level. Evaluation-level errors cover timestamps plus invalid counter counts, remaining hours, rate snapshots, market ranges, order books, and entry configuration. Count must be a non-negative integer; time and rates must be finite and non-negative; ranges must have unique token identities and cannot overlap; quote numbers and configuration bounds must be finite. Common candidate blockers include `COUNTER_STALE`, `ORDERBOOK_STALE`, `NO_TRADABLE_ASK`, `MIN_ORDER_SIZE_UNAVAILABLE`, `ORDER_NOTIONAL_BELOW_MINIMUM`, `LIMIT_ORDER_SIZE_BELOW_MARKET_MINIMUM`, and the sleeve-specific state and price codes returned in `checks[].blockers`.

`MuskTweetCountEntryDecision` preserves `currentEvaluation` and `nextEvaluation`, identifies the selected evaluation, and returns one selector reason: `NEXT_MARKET_INTENT`, `CURRENT_MARKET_INTENT`, `NEXT_MARKET_REJECTED`, `CURRENT_MARKET_REJECTED`, `INVALID_INPUT`, or `NO_CANDIDATE`. A candidate with `status: 'rejected'` is an audit explanation, never an execution instruction.

## Persistent risk stops and host boundary

`maxTaskNetProfitUsd` and `maxTaskNetLossUsd`, when configured, apply independently of sizing mode. Task-bankroll mode additionally supports `minRemainingBankrollUsd`. Daily loss, daily trade count, global controls, exposure completeness, and concurrency-safe persistence remain host responsibilities.

Polybot remains responsible for discovery, XTracker collection, timestamp-to-freshness comparison, audit, persistence, global controls, signing, submission, cancellation, reconciliation, take-profit management, settlement, and alerts. The execution host must repeat freshness, balance, tick, price, and venue minimum validation immediately before submission.

The model and execution-policy versions are declared by `MUSK_TWEET_COUNT_STRATEGY_MANIFEST`. These rules are experimental and are not a profitability guarantee or financial advice.
