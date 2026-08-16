# Virae Strategy Core

[![npm version](https://img.shields.io/npm/v/%40viraeai%2Fvirae-strategy-core?logo=npm)](https://www.npmjs.com/package/@viraeai/virae-strategy-core)
[![CI](https://github.com/Virae-Labs/virae-strategy-core/actions/workflows/ci.yml/badge.svg)](https://github.com/Virae-Labs/virae-strategy-core/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/node/v/%40viraeai%2Fvirae-strategy-core)](https://www.npmjs.com/package/@viraeai/virae-strategy-core)
[![license](https://img.shields.io/npm/l/%40viraeai%2Fvirae-strategy-core)](./LICENSE)

Deterministic, side-effect-free strategy logic for short-duration crypto prediction markets.

The package turns normalized round, oracle, order-book, risk, and configuration snapshots into decisions and order intents. It never reads credentials, calls an exchange, signs an order, writes a database, or moves funds.

> **Experimental software.** The probability and cost models are explicit heuristics, not guarantees of accuracy or profitability. The reference configuration is for examples, paper trading, and replay—not financial advice or a production recommendation.

## Install

```bash
npm install --save-exact @viraeai/virae-strategy-core@0.0.2
```

Pin exact versions in systems that can submit real orders. Review the changelog and replay representative fixtures before every upgrade.

## What the strategy does

The included `crypto-tail-directional` strategy evaluates a binary **Up/Down** market near the end of a fixed-duration round. In broad terms it:

1. verifies the round, settlement source, oracle, order book, liquidity, and risk state;
2. measures the reference-price lead from the round start;
3. selects the matching Up or Down token;
4. applies time, distance, spread, depth, price, consistency, and risk gates;
5. estimates an all-in cost and heuristic win probability;
6. returns `WAIT`, `SKIP`, or `ELIGIBLE` with a stable reason code;
7. converts an eligible decision into a bounded limit-order intent;
8. provides deterministic chase, exit, and lifecycle policies.

See [Strategy design](./docs/strategy/crypto-tail.md) for the formulas, gate order, assumptions, and limitations.

## Quick start

```ts
import {
  buildCryptoTailEntryExecutionPlan,
  decideCryptoTailEntry,
  REFERENCE_CRYPTO_TAIL_CONFIG_V1,
  type CryptoTailDecisionInput,
} from '@viraeai/virae-strategy-core/crypto-tail';

const input: CryptoTailDecisionInput = {
  nowSec: 1_800_000_880,
  round: {
    roundKey: 'btc-updown-15m-1800000000',
    eventSlug: 'btc-updown-15m-1800000000',
    eventTitle: null,
    eventImage: null,
    eventIcon: null,
    marketId: 'market-1',
    marketQuestion: 'Will BTC finish up?',
    marketImage: null,
    marketIcon: null,
    upTokenId: 'up-token',
    downTokenId: 'down-token',
    upOutcomeLabel: 'Up',
    downOutcomeLabel: 'Down',
    roundStartSec: 1_800_000_000,
    roundEndSec: 1_800_000_900,
    priceToBeat: 100_000,
    priceToBeatSource: 'chainlink',
    resolutionPriceModel: {
      kind: 'chainlink-twap',
      asset: 'BTC',
      windowSeconds: 60,
      configId: null,
    },
    active: true,
    closed: false,
    acceptingOrders: true,
    enableOrderBook: true,
    orderMinSize: 5,
    liquidityClob: 20_000,
    settlementSourceOk: true,
    metadataFresh: true,
  },
  chainlink: {
    startPrice: 100_000,
    currentPrice: 100_120,
    currentPointTs: 1_800_000_880,
    fresh: true,
    priceModel: null,
  },
  orderbook: {
    bestAsk: 0.92,
    bestBid: 0.915,
    spread: 0.005,
    topDepthUsd: 100,
    tickSize: 0.01,
    fresh: true,
  },
  config: REFERENCE_CRYPTO_TAIL_CONFIG_V1,
  risk: {
    dailyLossUsd: 0,
    taskNetLossUsd: 0,
    consecutiveLosses: 0,
    tradesToday: 0,
    hasRoundExecution: false,
  },
  global: {
    enabled: true,
    liveTradingEnabled: true,
    maxNotionalUsd: null,
  },
};

const decision = decideCryptoTailEntry(input);
const execution = buildCryptoTailEntryExecutionPlan({
  decision,
  config: input.config,
});

if (execution.ok) {
  // Send this intent to your own validated execution adapter.
  console.log(execution.plan.order);
} else {
  console.log(decision.reasonCode, decision.reasonMessage);
}
```

The repository includes a runnable [decision and plan example](./examples/decision-and-plan.cjs):

```bash
npm run example
```

## Decision semantics

| Decision | Meaning | Host action |
| --- | --- | --- |
| `WAIT` | Conditions may become eligible later in the same round. | Re-evaluate using a fresh snapshot. |
| `SKIP` | The current snapshot or round is not eligible. | Do not submit an order. |
| `ELIGIBLE` | All entry gates passed and the payload is complete. | Build a plan, then run host-side safety checks. |
| `ORDER_SUBMITTED` / `ORDER_BLOCKED` | Reserved host lifecycle values retained for compatibility. | Persist and reconcile in the host. |

Every decision includes a stable `reasonCode`, a human-readable message, and the available calculation outputs. `buildCryptoTailGateDiagnostics` provides a UI-friendly view of individual gate states.

## Public modules

Both imports expose the same API:

```ts
import { decideCryptoTailEntry } from '@viraeai/virae-strategy-core';
import { decideCryptoTailEntry } from '@viraeai/virae-strategy-core/crypto-tail';
```

The package includes:

- entry decisions and gate diagnostics;
- probability, cost, distance, consistency, and limit-price helpers;
- entry execution plans and one-shot chase policy;
- direction-flip and distance-collapse exit decisions;
- a pure lifecycle reducer that emits commands but performs no side effects;
- a versioned strategy manifest and reference configuration;
- TypeScript declarations and source maps.

See the [API guide](./docs/api.md) for the export map and [integration guide](./docs/integration.md) for host responsibilities.

## Safety boundary

This package intentionally does **not** provide:

- market discovery or live market-data clients;
- oracle freshness guarantees;
- wallet, key, signature, or authorization handling;
- geographic, venue, balance, or compliance checks;
- order idempotency, submission, cancellation, reconciliation, or settlement;
- persistence, alerts, dashboards, or operational controls;
- a claim that a decision has positive expected value.

An execution host must validate every returned intent and fail closed when data is missing, stale, inconsistent, or outside venue rules. Start with replay and paper trading. Read the [integration safety checklist](./docs/integration.md#production-safety-checklist) before connecting any adapter to real funds.

## Documentation

- [Crypto Tail strategy design](./docs/strategy/crypto-tail.md)
- [Integration and safety boundary](./docs/integration.md)
- [Public API guide](./docs/api.md)
- [Testing and replay](./docs/testing.md)
- [Release process](./docs/releasing.md)
- [Contributing](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Changelog](./CHANGELOG.md)

## Development

Requires Node.js 20 or newer.

```bash
npm ci
npm run check
npm run test:coverage
```

`npm run check` performs strict type checking, all Jest suites, a production build, an actual tarball installation into a temporary consumer, CommonJS/ESM loading, and downstream TypeScript compilation.

## License

Apache-2.0 © Virae Labs.
