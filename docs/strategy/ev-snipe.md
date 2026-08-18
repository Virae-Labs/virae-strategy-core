# EV Snipe simulation contract

## Status

EV Snipe is **simulation only**. The package exports a deterministic policy and system-level matrix; it does not indicate that Virae Agents currently supports live EV Snipe execution.

The initial contract intentionally separates:

- **Confirm-hit:** a source-equivalent trade crosses the market strike, after which the host may attempt to buy the winning token before the venue fully reprices it.
- **Pre-hit:** a trade enters a narrow band before the strike. This is directional speculation, requires an explicit externally estimated win probability, and must not inherit Confirm-hit certainty.

## Normalized input

`decideEvSnipeEntry` receives one coherent snapshot containing:

- an already parsed hit-price market specification;
- consecutive source trade prices and exchange/receive timestamps, including bounded source transport latency;
- the current executable YES-token quote and available ask notional;
- an explicit evaluation time and bounded strategy configuration;
- an estimated win probability for Pre-hit only.

`market.priceSource` and `tick.priceSource` are opaque, canonical host identifiers. They must encode the exact source, instrument, and price semantics required by the market rules. String equality is necessary but not sufficient: the host remains responsible for proving the normalization is faithful to the official resolution text.

## Decision flow

The core fails closed for malformed inputs, source/symbol mismatch, trades outside the market window, excessive exchange-to-receive transport latency, stale triggers or quotes, unavailable markets, token mismatch, no liquidity, price above the FAK guard, and insufficient fee-adjusted edge.

Confirm-hit requires a crossing, not merely a price already beyond the strike:

- `HIT_UP_GTE`: previous price `< strike`, current price `>= strike`;
- `HIT_DOWN_LTE`: previous price `> strike`, current price `<= strike`.

Pre-hit requires entry into the configured band from outside, an explicit probability, sufficient modeled edge, and more time remaining than `preHitDisableBeforeEndMs`.

An `ELIGIBLE` result produces a deterministic BUY/FAK intent with a stable condition/leg/rule key. It is not permission to submit.

## Economics

The decision estimates net edge per share as:

```text
win probability
- ask price
- taker fee rate * ask price * (1 - ask price)
- builder fee rate * ask price
```

The formula is an explicit simulation model. A production host must load the actual per-market fee schedule and any platform fee before evaluation. It must not assume that a configured maximum buy price is the actual fill price.

`simulateEvSnipeFill` models FAK no-fill, partial-fill, and full-fill outcomes, protocol/builder fees, binary payout, and PnL. Protocol fees are rounded to the venue's documented five-decimal precision. Invalid fee models throw instead of returning misleading economics. The simulator deliberately exposes the strategy's small-win/large-loss asymmetry.

## System simulation matrix

`buildEvSnipeSystemSimulationMatrix()` returns version-controlled scenarios across five categories:

| Category | Covered behavior |
| --- | --- |
| Trigger | Up/down exact-boundary crossing and no crossing |
| Data quality | Source/symbol mismatch, stale data, and market window |
| Execution | FAK full, partial, and no-fill outcomes |
| Economics | Maximum price, net edge after fees, winning and losing resolution |
| Pre-hit | Band entry, required probability, and cutoff disablement |

`runEvSnipeSystemSimulationMatrix()` evaluates decisions and optional fills, then reports per-row mismatches. The same serialized scenarios should be replayed by a host adapter before any shadow or live rollout.

## Host boundary

The host must provide market discovery and exact rules parsing, a gap-aware trade stream, quote acquisition, clock synchronization, durable condition/leg claims, wallet and risk controls, FAK submission, unknown-outcome reconciliation, settlement, and audit persistence.

The core intentionally contains no EVPLUS/EVPOLY source code, network endpoints, credentials, or live execution integration.
