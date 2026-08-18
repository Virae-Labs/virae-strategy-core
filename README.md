# Virae Strategy Core

[![npm version](https://img.shields.io/npm/v/%40viraeai%2Fvirae-strategy-core?logo=npm)](https://www.npmjs.com/package/@viraeai/virae-strategy-core)
[![CI](https://github.com/Virae-Labs/virae-strategy-core/actions/workflows/ci.yml/badge.svg)](https://github.com/Virae-Labs/virae-strategy-core/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/node/v/%40viraeai%2Fvirae-strategy-core)](https://www.npmjs.com/package/@viraeai/virae-strategy-core)
[![license](https://img.shields.io/npm/l/%40viraeai%2Fvirae-strategy-core)](./LICENSE)

Deterministic, side-effect-free prediction-market strategy decisions, execution policies, and replay contracts.

## Strategies at a glance

| Strategy | Markets | What the core produces | Highlights |
| --- | --- | --- | --- |
| [Crypto Tail](./docs/strategy/crypto-tail.md) | BTC/ETH/SOL/DOGE/XRP/BNB Up/Down (15m; BTC/ETH also 1h) | `WAIT` / `SKIP` / `ELIGIBLE`, entry plan, chase, exit, lifecycle commands | Time-and-distance signal, TWAP/spot consistency, spread/depth/risk gates, bounded lifecycle |
| [Pre-M](./docs/strategy/pre-market.md) | BTC 15m Up/Down before market open | 12 dual-sided BUY ladder intents and fill-aware take-profit SELL intents | Safe/Normal/Aggressive ladders, stable per-round keys, explicit cancellation deadline |
| [Musk Tweet Count](./docs/strategy/musk-tweet-count.md) | Current and next Polymarket tweet-count markets | Sleeve evaluations plus one canonical selected or rejected intent | Low/high-tail No, late directional Yes, lottery Yes, next-market preposition |
| [Weather Temperature](./docs/strategy/weather-temperature.md) | Daily high/low temperature buckets | Ranked YES limit-order intents and per-bucket evaluations | GFS ensemble probabilities, station-local timing, Strict/Core/Wide profiles, TOP1 or adjacent TOP2 |
| [EV Snipe](./docs/strategy/ev-snipe.md) | Crypto hit-price markets (simulation only) | Confirm-hit/Pre-hit decision, FAK intent, fill/PnL simulation, system matrix | Exact crossing semantics, source/freshness/edge gates, explicit small-win/large-loss evidence |

### Why use this package

- **Reproducible:** pure synchronous functions with explicit time and normalized snapshots.
- **Auditable:** stable manifests, reason codes, intent keys, and machine-readable strategy catalog.
- **Fail closed:** malformed, stale, unavailable, or out-of-policy inputs do not authorize execution.
- **Execution-neutral:** returns decisions, plans, and intents; never reads a wallet, signs, submits, or moves funds.
- **Integration-friendly:** focused package subpaths, TypeScript declarations, replay support, and a bundled AI skill.

> **Experimental software.** The models are explicit heuristics, not guarantees of accuracy or profitability. Validate every strategy with replay, paper trading, and your own market-rule analysis before risking funds.

## Install

```bash
npm install --save-exact @viraeai/virae-strategy-core@0.5.0
```

Pin exact versions in money-moving systems. Review the [changelog](./CHANGELOG.md) and replay representative fixtures before every upgrade.

## Discover and import strategies

The root exports every strategy and `VIRAE_STRATEGY_CORE_CATALOG`. Prefer a focused subpath in production consumers.

```ts
import { VIRAE_STRATEGY_CORE_CATALOG } from '@viraeai/virae-strategy-core';
import { decideCryptoTailEntry } from '@viraeai/virae-strategy-core/crypto-tail';
import { buildPreMarketEntryPlan } from '@viraeai/virae-strategy-core/pre-market';
import { decideMuskTweetCountEntry } from '@viraeai/virae-strategy-core/musk-tweet-count';
import { decideWeatherTemperatureEntry } from '@viraeai/virae-strategy-core/weather-temperature';
import { runEvSnipeSystemSimulationMatrix } from '@viraeai/virae-strategy-core/ev-snipe';

for (const strategy of VIRAE_STRATEGY_CORE_CATALOG) {
  console.log(strategy.key, strategy.manifest.modelVersion, strategy.capabilities);
}
```

Every catalog entry declares its package module, hosted Auto Trade keys, manifest, and capabilities. The capabilities explicitly report `networkAccess: false` and `orderSubmission: false`.

## How it fits into a trading system

```text
market / forecast / oracle / risk adapters
                    |
                    v
           normalized snapshot
                    |
                    v
          Virae Strategy Core
      decision / plan / order intent
                    |
                    v
 host validation -> durable claim -> venue adapter
                    |
                    v
        reconciliation and settlement
```

| Strategy Core owns | The execution host owns |
| --- | --- |
| Deterministic gates and selection | Market discovery and settlement-rule verification |
| Configuration normalization | Network calls and timestamp-to-freshness checks |
| Prices, sizes, reason codes, and intent keys | Durable risk, concurrency, balance, and compliance controls |
| Pure chase, exit, or lifecycle policies where exported | Signing, submission, cancellation, reconciliation, and settlement |
| Versioned manifests and replayable contracts | Monitoring, alerts, audit storage, secrets, and wallets |

Calling this package never submits an order. A returned `ELIGIBLE`, generated intent, or entry plan is input to a separate host-side safety and execution flow.

## Decision semantics by strategy

- **Crypto Tail:** `WAIT` means a fresh snapshot in the same round may qualify; `SKIP` means do not submit; `ELIGIBLE` permits building an execution plan, not sending it.
- **Pre-M:** `buildPreMarketEntryPlan` returns either twelve intents or a typed failure. Take-profit generation uses reconciled net open shares only.
- **Musk Tweet Count:** the selector prioritizes an eligible next-market preposition, then the first eligible current sleeve. Rejected candidates are returned for audit and are never executable.
- **Weather Temperature:** the decision returns `ENTRY_INTENTS`, `NO_ELIGIBLE_BUCKET`, or `INVALID_INPUT`, plus an evaluation for every bucket and typed diagnostics.
- **EV Snipe:** `ELIGIBLE` means a normalized Confirm-hit or explicitly modeled Pre-hit passed the pure gates. The strategy remains simulation-only and the host must prove resolution-source equivalence before considering execution.

See the [public API guide](./docs/api.md) for functions and types, and the [integration guide](./docs/integration.md) for the production host contract.

## Hosted execution with Virae Agents

Supported strategies can also run through [Virae Agents](https://www.virae.ai/agents/v/pro?section=strategies), which provides market data, persistent scheduling, execution, reconciliation, monitoring, and an operational interface around the versioned strategy logic.

**[Open Virae Agents →](https://www.virae.ai/agents/v/pro?section=strategies)**

The hosted product and this library are separate execution boundaries. Current Paper/Live availability is shown in the Agents interface.

AI agents can use the bundled [`virae-strategy-core` skill](./skills/virae-strategy-core/SKILL.md) to list the installed catalog, evaluate user-supplied snapshots, and replay them locally. It produces decisions and intents only.

## Safety boundary

This package intentionally does **not** provide live data clients, freshness guarantees, private-key handling, geographic or compliance checks, durable idempotency, order submission, persistence, or profitability claims.

Before submission, a host must revalidate market state, data freshness, tick/precision, minimum size, balance, exposure, risk stops, live-trading gates, and durable deduplication. A timeout is an unknown order outcome, not proof of failure; reconcile before retrying. Read the [production safety checklist](./docs/integration.md#production-safety-checklist).

## Documentation

- [Crypto Tail strategy design](./docs/strategy/crypto-tail.md)
- [Pre-M strategy design](./docs/strategy/pre-market.md)
- [Musk Tweet Count strategy design](./docs/strategy/musk-tweet-count.md)
- [Weather Temperature strategy design](./docs/strategy/weather-temperature.md)
- [EV Snipe simulation contract](./docs/strategy/ev-snipe.md)
- [Public API guide](./docs/api.md)
- [Integration and safety boundary](./docs/integration.md)
- [Testing and replay](./docs/testing.md)
- [Release process](./docs/releasing.md)
- [Contributing](./CONTRIBUTING.md), [security](./SECURITY.md), and [changelog](./CHANGELOG.md)

## Development

Requires Node.js 20 or newer.

```bash
npm ci
npm run check
npm run test:coverage
```

`npm run check` runs strict type checking, all Jest suites, a production build, an actual tarball installation into a temporary consumer, CommonJS/ESM loading, and downstream TypeScript compilation. The repository also includes a runnable [Crypto Tail decision example](./examples/decision-and-plan.cjs).

## License and required attribution

CPAL-1.0 © Virae Labs. Graphical executables, including Larger Works, must prominently display “Powered by Virae Strategy Core” linked to [https://www.virae.ai/](https://www.virae.ai/), as specified in Exhibit B of [LICENSE](./LICENSE). External network deployment also triggers the source-availability obligations in CPAL-1.0.
