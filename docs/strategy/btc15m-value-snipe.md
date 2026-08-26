# BTC 15m Value Snipe contract

## Status and identity

BTC 15m Value Snipe is a venue-aware value strategy for recurring BTC 15-minute markets. It is distinct from Hit Price Snipe: it estimates a directional win probability throughout the configured entry window and compares that probability with executable all-in cost; it does not wait for a strike crossing.

The manifest declares host execution support. Polymarket and Predict.fun hosts may implement paper or live execution using the same decision contract, but each host owns venue discovery, fees, slippage, signing, submission, reconciliation, and settlement.

## Venue contract

`decideBtc15mValueSnipeEntry` accepts:

- `venue`: `POLYMARKET` or `PREDICT_FUN`;
- a normalized Crypto Tail snapshot for BTC and a 15-minute recurring round;
- an explicit `estimatedAllInCost`, expressed as cost per winning share after venue fees, host fees, and expected slippage;
- `minEdgeBps`, the minimum difference between estimated win probability and all-in cost.

The core deliberately does not encode mutable fee schedules. A host must calculate all-in cost from current executable quotes and the venue's actual fee model. The value must be finite, below `1.00`, and no lower than the executable limit price.

The normalized settlement price model must match the venue:

| Venue | Required normalized price model |
| --- | --- |
| Polymarket | a `chainlink-*` model matching that market's official rules |
| Predict.fun | `binance`, matching the recurring-market contract used by the host |

This check validates an explicit normalization claim; it does not replace inspection of the venue's official market rules.

## Decision flow

The wrapper reuses the Crypto Tail timing, direction, freshness, spread, liquidity, price, risk, and market-state gates. It disables Crypto Tail's embedded cost approximation, then applies the explicit venue all-in cost:

```text
edge bps = (estimated win probability - estimated all-in cost) * 10,000
```

`VALUE_EDGE_TOO_SMALL` returns `WAIT`, because a fresh quote in the same round may improve. Invalid all-in cost or a price-model mismatch returns `SKIP`. `ELIGIBLE` remains an input to host-side validation and is never permission to submit by itself.

## System simulation matrices

`buildBtc15mValueSnipeSystemSimulationMatrix(venue)` returns ten scenarios for one venue. `runBtc15mValueSnipeSystemSimulationMatrix()` runs both venue matrices by default. Each matrix covers:

- positive and insufficient value edge;
- invalid all-in cost;
- stale oracle and order book data;
- unconfirmed settlement metadata and wrong venue price model;
- low liquidity and excessive spread;
- evaluation after the entry window.

Consumers should run the exact installed matrix through their normalization boundary before paper or live rollout and retain the manifest/model version with each result.

## Host boundary

The host must also enforce durable task state, per-user and global risk limits, balance and allowance checks, exact order minimums and precision, idempotent round claims, unknown-outcome reconciliation, and settlement accounting. Strategy Core performs no network or wallet operation.
