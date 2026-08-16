# Public API guide

The root entry point exposes all strategies. Prefer `/crypto-tail`, `/pre-market`, or `/musk-tweet-count` for focused imports.

```ts
import * as strategyCore from '@viraeai/virae-strategy-core';
import * as cryptoTail from '@viraeai/virae-strategy-core/crypto-tail';
import * as preMarket from '@viraeai/virae-strategy-core/pre-market';
import * as muskTweetCount from '@viraeai/virae-strategy-core/musk-tweet-count';
```

## Manifest and reference data

### `CRYPTO_TAIL_STRATEGY_MANIFEST`

Stable identity fields for audit and replay: strategy ID, model version, input schema version, execution policy version, supported assets, and supported intervals.

### `REFERENCE_CRYPTO_TAIL_CONFIG_V1`

A runnable configuration for examples and paper replay. It is not production calibration or financial advice.

## Entry decisions

### `decideCryptoTailEntry(input)`

Returns a `CryptoTailDecisionResult` containing the decision, stable reason code, explanation, candidate outcome/token, timing, distance, probability/cost estimate, edge, notional, and limit price.

### `buildCryptoTailGateDiagnostics(input)`

Returns individual `pass`, `fail`, or `pending` diagnostics suitable for operator and UI surfaces. Diagnostics explain the snapshot; the decision function remains authoritative.

### Calculation helpers

- `estimateCryptoTailAllInCost(ask)`
- `estimateCryptoTailWinProbability(params)`
- `requiredBtc15mDistanceBps(input, secondsToEnd)`
- `resolveBtc15mEntryLimitPrice(params)`
- `btc15mSpotContradictsSignal(params)`
- `twapWindowSeconds(model)`

The `Btc15m` names are compatibility exports. The generic `CryptoTail` decision types and aliases are preferred for new integrations.

## Execution

### `buildCryptoTailEntryExecutionPlan({ decision, config })`

Returns either a complete entry plan or a typed failure reason. A plan includes strategy identity, a limit-order intent, cancel timeout, chase limits, and exit-policy values.

### `evaluateCryptoTailChase(input)`

Determines whether a single bounded chase is eligible and returns the replacement price.

### `buildCryptoTailChaseOrder(plan, chasePrice)`

Builds a replacement order intent without mutating the original plan.

## Exit

### `evaluateCryptoTailExit(params)`

Returns a direction-flip, distance-collapse, held, ended-round, or unavailable-oracle result. It does not submit an exit order.

## Lifecycle

### `createCryptoTailLifecycleState()`

Creates the initial pure state.

### `reduceCryptoTailLifecycle(state, event)`

Returns the next state and zero or more descriptive commands. The reducer does not deduplicate, persist, or execute commands.

## TypeScript types

The package exports complete input, configuration, decision, order-intent, exit, and lifecycle types. Declarations support both classic `moduleResolution: "node"` and modern Node module resolution.

## Compatibility

- Runtime format: CommonJS with Node-compatible ESM interop.
- Minimum Node version: 20.
- TypeScript declarations and declaration maps are included.
- Package subpaths are controlled by `exports`; do not import internal `dist` files.

Any undocumented deep import is unsupported.

## Pre-M dual ladder

### `buildPreMarketEntryPlan({ round, config })`

Returns twelve deterministic BUY intents across Up and Down, or a fail-closed reason when the round, market, token IDs, or launch window are invalid or unavailable. Each intent includes a stable per-round key; the host must namespace it by task/account when uniqueness is global.

### `buildPreMarketTakeProfitIntents(params)`

Aggregates multiple ladder fills and builds at most one SELL intent per outcome after the configured delay. Targets use actual net open shares and filled notional, never requested entry size. Malformed positions, conflicting token IDs, and quantities below the package's `0.01`-share output precision do not produce an intent.

### `normalizePreMarketStrategyConfig(input)`

Validates ladder mode, side budget, launch lead/grace, cancel window, and take-profit bounds. A host remains responsible for venue minimums, persistence, idempotency, signing, cancellation, reconciliation, and risk controls.

See [Pre-M strategy design](./strategy/pre-market.md) for the exact ladders, configuration bounds, rounding rules, and host lifecycle contract.

## Musk tweet count

### `decideMuskTweetCountEntry(params)`

Evaluates the current snapshot and optional next snapshot with an explicit `nowSec`, then selects next-market BUY, current-market BUY, invalid input, next rejected, or current rejected in canonical priority order. The result includes both evaluations and a stable selector reason code. Invalid time values fail closed with `reasonCode: 'INVALID_INPUT'`.

### `evaluateMuskTweetStrategy(snapshot, config, nowSec)`

Returns eligible intents, rejected candidates, per-sleeve checks, diagnostics, and an optional typed `inputErrorCode` for the current market. Stale counter or selected-orderbook data always blocks new intents.

### `evaluateMuskTweetNextMarketPreposition(current, next, config, nowSec)`

Evaluates the next-market No preposition window without reading wall-clock time. Both current and next counters and the selected next-market orderbook must be fresh.

### Supporting exports

`normalizeMuskTweetStrategyConfig`, `selectMuskEvaluationSnapshots`, `resolveMuskTweetPersistentRiskStop`, `DEFAULT_MUSK_TWEET_STRATEGY_CONFIG`, and `MUSK_TWEET_COUNT_STRATEGY_MANIFEST` are public. See [Musk tweet-count strategy design](./strategy/musk-tweet-count.md).
