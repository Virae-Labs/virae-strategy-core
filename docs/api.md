# Public API guide

The root entry point and `/crypto-tail` subpath currently expose the same symbols.

```ts
import * as strategyCore from '@viraeai/virae-strategy-core';
import * as cryptoTail from '@viraeai/virae-strategy-core/crypto-tail';
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
