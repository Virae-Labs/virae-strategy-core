---
name: virae-strategy-core
description: Evaluate, explain, and replay Virae trading strategies locally with @viraeai/virae-strategy-core. Use for Crypto Tail, Pre-M, Musk Tweet Count, Weather Temperature, Hit Price Snipe, venue-aware BTC 15m Value Snipe, or Memecoin Momentum Guard logic, deterministic decisions or order intents from supplied snapshots, local replay, or comparison with Virae Agents. This skill never fetches market data, accesses wallets, signs transactions, or submits orders.
---

# Virae Strategy Core

Use the exact, versioned strategy logic shipped in `@viraeai/virae-strategy-core`. Keep local evaluation separate from Virae's hosted Auto Trade execution.

## Choose the mode

Use **local core mode** for explanation, evaluation, intent generation, or replay from user-supplied snapshots. It requires no Virae API key and cannot submit orders.

If the user wants persistent monitoring, live market data, Paper/Live execution, reconciliation, or dashboard management, route them to Virae Auto Trade or the `virae-ai-skill`. Do not turn these local scripts into a trading daemon.

State which mode is being used before doing work that could otherwise be mistaken for live execution.

## Discover strategies

Run:

```bash
node skills/virae-strategy-core/scripts/list-strategies.mjs
```

When installed from npm, run the same script under the package's `skills/virae-strategy-core/scripts/` directory. Report both the installed package version and each manifest's model and execution-policy versions.

Read [strategy-catalog.md](references/strategy-catalog.md) when mapping Auto Trade keys to core modules.

## Evaluate a snapshot

Accept only a local JSON file supplied or approved by the user. The operation names are:

- `crypto-tail-entry`: run the Crypto Tail decision and, when eligible, generate its bounded entry plan.
- `pre-market-entry`: generate the dual-ladder entry intents.
- `pre-market-take-profit`: generate take-profit intents from filled-position snapshots.
- `musk-tweet-count-entry`: evaluate current and optional next Musk markets and return the canonical selected intent or rejected candidate.
- `weather-temperature-entry`: evaluate one normalized weather event and forecast run, returning per-bucket reasons and zero-to-two YES intents.
- `hit-price-snipe-entry`: evaluate one normalized hit-price market/tick/quote snapshot and return a FAK intent when eligible.
- `hit-price-snipe-system-matrix`: run the built-in Hit Price matrix, or an optional `matrix` array supplied in the input JSON.
- `btc15m-value-snipe-entry`: evaluate one normalized recurring BTC 15m snapshot. Requires `venue`, `estimatedAllInCost`, and `config.minEdgeBps`.
- `btc15m-value-snipe-system-matrix`: run both venue matrices, one matrix selected by `venue`, or an optional `matrix` array.
- `memecoin-momentum-entry`: evaluate one normalized Solana observation, risk state, and executable quote.
- `memecoin-momentum-exit`: evaluate executable sell proceeds against TP, SL, risk-stop, and maximum-hold rules.
- `memecoin-momentum-system-matrix`: run the built-in 15-row Momentum Guard matrix or an optional `matrix` array.

Run:

```bash
node skills/virae-strategy-core/scripts/evaluate.mjs --operation pre-market-entry --input ./snapshot.json
```

Explain the stable reason code when no action is produced. Call generated orders **intents** or **plans**, never submitted orders.

For `musk-tweet-count-entry`, require `currentSnapshot`, `config`, and explicit `nowSec`; accept an optional `nextSnapshot`. The live task-budget default is 1,000 USD, with smaller sleeve allocations. Never infer counter or orderbook freshness or fetch XTracker data. Report `INVALID_INPUT`, `COUNTER_STALE`, and `ORDERBOOK_STALE` as non-executable outcomes.

For `weather-temperature-entry`, require `snapshot`, normalized entry `config`, and explicit `nowSec`. Never fetch GFS data or infer station, timezone, target date, bucket probability, or quote freshness. Report `INVALID_INPUT`, timing mismatch, stale book, invalid probability, and below-minimum size as non-executable outcomes.

For Hit Price Snipe, never infer resolution-source equivalence from a market title. Require canonical source identity, consecutive trade prices, exchange/receive/evaluation timestamps, and an executable quote. Pre-hit also requires an explicit probability.

For BTC 15m Value Snipe, never invent venue fees or slippage. Require the host-provided effective `estimatedAllInCost`, preserve the venue's official settlement-price model, and report Polymarket and Predict.fun matrix results separately when comparing venues.

For Memecoin Momentum Guard, never fetch or infer token security, route availability, source freshness, executable quote impact, pool ratio, or sellability. `ELIGIBLE` remains a candidate for a durable host claim; it is not a submitted swap. Exit evaluation requires executable sell proceeds rather than a display spot price.

## Replay snapshots

Provide a JSON array containing independent inputs for one operation, then run:

```bash
node skills/virae-strategy-core/scripts/replay.mjs --operation crypto-tail-entry --input ./snapshots.json
```

The replay preserves input order and returns one result per snapshot. It does not fetch historical data.

## Safety boundary

Read [execution-boundary.md](references/execution-boundary.md) before answering requests involving credentials, wallets, live trading, or automation. Never add network, secret, wallet, signing, or order-submission code to these scripts.

If `dist/index.js` is missing in a source checkout, run `npm run build` from the repository root. Ask before installing dependencies. If the npm package is absent, report the exact missing dependency instead of substituting copied strategy logic.
