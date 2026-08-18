# Public API guide

## Entry points

The root entry point exports all strategies and the catalog. Focused imports reduce name collisions and make ownership clear.

```ts
import { VIRAE_STRATEGY_CORE_CATALOG } from '@viraeai/virae-strategy-core';
import * as cryptoTail from '@viraeai/virae-strategy-core/crypto-tail';
import * as preMarket from '@viraeai/virae-strategy-core/pre-market';
import * as muskTweetCount from '@viraeai/virae-strategy-core/musk-tweet-count';
import * as weatherTemperature from '@viraeai/virae-strategy-core/weather-temperature';
import * as evSnipe from '@viraeai/virae-strategy-core/ev-snipe';
```

| Module | Primary decision/plan API | Manifest |
| --- | --- | --- |
| `/crypto-tail` | `decideCryptoTailEntry` | `CRYPTO_TAIL_STRATEGY_MANIFEST` |
| `/pre-market` | `buildPreMarketEntryPlan` | `PRE_MARKET_STRATEGY_MANIFEST` |
| `/musk-tweet-count` | `decideMuskTweetCountEntry` | `MUSK_TWEET_COUNT_STRATEGY_MANIFEST` |
| `/weather-temperature` | `decideWeatherTemperatureEntry` | `WEATHER_TEMPERATURE_STRATEGY_MANIFEST` |
| `/ev-snipe` | `decideEvSnipeEntry`, `runEvSnipeSystemSimulationMatrix` | `EV_SNIPE_STRATEGY_MANIFEST` |

`VIRAE_STRATEGY_CORE_CATALOG` is the machine-readable source for strategy key, module, hosted Auto Trade keys, capability flags, and manifest. Read the installed package version from its `package.json`; it is intentionally not duplicated in the catalog.

## Crypto Tail

### Decision and diagnostics

- `decideCryptoTailEntry(input)` returns `CryptoTailDecisionResult` with `WAIT`, `SKIP`, or `ELIGIBLE`, stable reason code/message, candidate identity, timing, distance, probability/cost estimate, edge, notional, and limit price.
- `buildCryptoTailGateDiagnostics(input)` returns individual `pass`, `fail`, or `pending` diagnostics for operator/UI use. The decision remains authoritative.
- `REFERENCE_CRYPTO_TAIL_CONFIG_V1` is a reproducible example/paper configuration, not production calibration.

Calculation helpers include `estimateCryptoTailAllInCost`, `estimateCryptoTailWinProbability`, `requiredBtc15mDistanceBps`, `resolveBtc15mEntryLimitPrice`, `btc15mSpotContradictsSignal`, and `twapWindowSeconds`. The `Btc15m` names are compatibility exports; generic Crypto Tail types and aliases are preferred for new integrations.

### Execution, exit, and lifecycle

- `buildCryptoTailEntryExecutionPlan({ decision, config })` returns a complete bounded entry plan or typed failure.
- `evaluateCryptoTailChase(input)` decides one bounded replacement price; `buildCryptoTailChaseOrder(plan, chasePrice)` creates the replacement intent.
- `evaluateCryptoTailExit(params)` returns direction-flip, distance-collapse, held, ended-round, or unavailable-oracle state.
- `createCryptoTailLifecycleState()` and `reduceCryptoTailLifecycle(state, event)` implement a pure event reducer that emits descriptive commands.

See [Crypto Tail strategy design](./strategy/crypto-tail.md).

## Pre-M dual ladder

- `normalizePreMarketStrategyConfig(input)` validates mode, side budget, launch/cancel timing, and take-profit bounds.
- `preMarketPricesForMode(mode)` returns the six cent-rounded prices for Safe, Normal, or Aggressive mode.
- `buildPreMarketEntryPlan({ round, config })` returns twelve deterministic BUY intents and cancellation deadline, or a typed failure.
- `buildPreMarketTakeProfitIntents(params)` aggregates reconciled fill rows and returns at most one SELL intent per outcome after the configured delay.
- `DEFAULT_PRE_MARKET_STRATEGY_CONFIG`, `PRE_MARKET_LADDER_WEIGHTS`, `PRE_MARKET_NORMAL_PRICES`, and `PRE_MARKET_STRATEGY_MANIFEST` are public reference exports.

Malformed positions, conflicting token IDs, and quantities below `0.01` share produce no take-profit intent. The host must distinguish this conservative result from confirmed absence of exposure.

See [Pre-M strategy design](./strategy/pre-market.md).

## Musk Tweet Count

- `decideMuskTweetCountEntry(params)` applies canonical current/next selection with explicit `nowSec` and returns both evaluations plus one selected generated/rejected candidate.
- `evaluateMuskTweetStrategy(snapshot, config, nowSec)` exposes every current-market sleeve evaluation.
- `evaluateMuskTweetNextMarketPreposition(current, next, config, nowSec)` exposes the next-market No setup.
- `selectMuskEvaluationSnapshots` selects the active and earliest upcoming snapshots.
- `normalizeMuskTweetStrategyConfig` and `normalizeMuskTweetSimulationConfig` bound external configuration.
- `resolveMuskTweetPersistentRiskStop` returns a pure persistent task-stop reason from host risk state.
- `DEFAULT_MUSK_TWEET_STRATEGY_CONFIG`, `MUSK_TWEET_SIMULATION_MATRIX`, and `MUSK_TWEET_COUNT_STRATEGY_MANIFEST` are public.

Malformed time values return `INVALID_INPUT`. Stale counters/books, unavailable minimum size, or rejected candidates never authorize execution.

See [Musk Tweet Count strategy design](./strategy/musk-tweet-count.md).

## Weather Temperature

- `normalizeWeatherTemperatureStrategyConfig({ entryConfig, riskConfig })` applies station, profile, timing, selection, budget, and risk defaults/bounds.
- `decideWeatherTemperatureEntry({ snapshot, config, nowSec })` returns zero-to-two YES limit intents, per-candidate evaluations, a top-level reason, and typed diagnostics.
- `evaluateWeatherTemperatureCandidate(config, candidate, context)` exposes one bucket's gate result when timing and forecast dispersion are already known.
- `weatherTemperatureLocalClock(timezone, now)` and `weatherTemperatureTimingEligible(config, snapshot, clock)` are low-level helpers for validated timezone/date inputs.
- `DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG`, `DEFAULT_WEATHER_TEMPERATURE_RISK_CONFIG`, `WEATHER_TEMPERATURE_SIGNAL_PROFILES`, `WEATHER_TEMPERATURE_SIMULATION_MATRIX`, `WEATHER_TEMPERATURE_CONFIG_VERSION`, and `WEATHER_TEMPERATURE_STRATEGY_MANIFEST` are public.

The primary decision validates malformed runtime inputs and fails closed. The normalized risk object is configuration for a stateful host; the pure decision cannot enforce daily/event/task limits without durable state.

See [Weather Temperature strategy design](./strategy/weather-temperature.md).

## EV Snipe

- `decideEvSnipeEntry(input)` evaluates a normalized Confirm-hit or Pre-hit snapshot and returns `WAIT`, `SKIP`, or `ELIGIBLE` with a typed reason and optional BUY/FAK intent.
- `estimateEvSnipeNetEdgeBps(params)` applies the explicit probability, price, protocol-fee, and builder-fee model.
- `simulateEvSnipeFill(input)` models FAK no-fill, partial/full fill, binary payout, fees, and PnL.
- `buildEvSnipeSystemSimulationMatrix()` returns the version-controlled system scenario corpus.
- `runEvSnipeSystemSimulationMatrix(matrix?)` evaluates the corpus and returns row-level mismatches.
- `DEFAULT_EV_SNIPE_STRATEGY_CONFIG` and `EV_SNIPE_STRATEGY_MANIFEST` are public reference exports.

The manifest is `SIMULATION_ONLY`; the catalog therefore has no hosted Auto Trade key for EV Snipe. See [EV Snipe simulation contract](./strategy/ev-snipe.md).

## Common integration rules

All primary strategy functions are synchronous and side-effect free. They do not fetch data or mutate caller input. Time-sensitive primary decisions accept caller-provided time so live and replay behavior can match.

Generated keys are stable within the strategy's documented identity scope but do not automatically include account or task. Namespace them before using a database uniqueness constraint that spans multiple users, tasks, or market lifecycles.

Runtime compatibility:

- Node.js 20 or newer;
- CommonJS output with Node-compatible ESM interop;
- TypeScript declarations and declaration maps;
- package subpaths controlled by `exports`.

Do not import undocumented internal `dist` paths. See the [integration guide](./integration.md) for persistence, execution, and production safety requirements.
