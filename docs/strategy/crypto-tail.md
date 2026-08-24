# Crypto Tail strategy design

## At a glance

| Item | Contract |
| --- | --- |
| Markets | BTC, ETH, SOL, DOGE, XRP, and BNB binary Up/Down rounds at 15 minutes and 1 hour |
| Primary API | `decideCryptoTailEntry` |
| Outputs | `WAIT`, `SKIP`, or `ELIGIBLE`; gate diagnostics; bounded execution plan |
| Additional policies | One-shot chase, direction-flip/distance-collapse exit, pure lifecycle reducer |
| Core boundary | No discovery, network, wallet, persistence, signing, or venue submission |

```ts
import {
  REFERENCE_CRYPTO_TAIL_CONFIG_V1,
  buildCryptoTailEntryExecutionPlan,
  decideCryptoTailEntry,
} from '@viraeai/virae-strategy-core/crypto-tail';

const decision = decideCryptoTailEntry({
  ...normalizedSnapshot,
  nowSec,
  config: REFERENCE_CRYPTO_TAIL_CONFIG_V1,
});
const plan = buildCryptoTailEntryExecutionPlan({
  decision,
  config: REFERENCE_CRYPTO_TAIL_CONFIG_V1,
});
```

`normalizedSnapshot` and `nowSec` are caller-provided. A successful plan is still only a limit-order intent.

## Status

- Strategy ID: `crypto-tail-directional`
- Model version: `heuristic-v3-twap`
- Input schema version: `2`
- Execution policy version: `2`
- Supported profiles: BTC, ETH, SOL, DOGE, XRP, and BNB at 15 minutes and 1 hour

The manifest is exported as `CRYPTO_TAIL_STRATEGY_MANIFEST`. Hosts should persist it with decisions and orders so a replay can identify the exact policy family that produced an intent.

## Objective

Crypto Tail is a deterministic directional policy for binary Up/Down markets. It evaluates whether the current reference-price lead is sufficiently supported, sufficiently late in the round, and executable at an acceptable market price.

It is deliberately a transparent heuristic. It is not a trained model, a price feed, a venue adapter, or proof of positive expected value.

## Inputs

The policy consumes an immutable snapshot:

- **Round:** time bounds, token IDs, market state, settlement-source confirmation, minimum order size, and reported liquidity.
- **Oracle:** round-start price, current reference price, optional spot price, timestamp, freshness, and resolution model.
- **Order book:** best ask/bid, spread, top ask depth, tick size, and freshness.
- **Risk:** daily loss, task loss, consecutive losses, daily trade count, and duplicate-round execution state.
- **Global controls:** live-trading permission and optional notional cap.
- **Configuration:** entry, execution, exit, and risk thresholds.

The caller owns normalization and freshness. Passing `fresh: true` is an assertion made by the caller; the package does not independently verify a timestamp or contact an oracle. The core still validates every execution-relevant numeric field at runtime and returns `INVALID_INPUT` rather than allowing `NaN`, infinities, or invalid bounds to pass through comparisons.

## Signal

For a start price `P0` and current reference price `Pt`:

```text
delta = Pt - P0
distanceBps = abs(delta) / P0 * 10,000
candidateOutcome = delta >= 0 ? Up : Down
```

The selected token is the token matching `candidateOutcome`. A missing token fails closed.

An exact zero distance does not establish either direction. It returns `WAIT` with `SIGNAL_DISTANCE_ZERO`; the time component cannot turn an absent signal into an eligible entry.

For a Chainlink TWAP-style resolution model, `Pt` is expected to represent the caller's current TWAP-compatible reference. The optional live spot point is used only by the consistency gate.

## Gate order

`decideCryptoTailEntry` evaluates gates in a stable order. The first failing gate determines the returned reason code.

1. Round exists and metadata is fresh.
2. Settlement source is confirmed.
3. Market is active, open, accepting orders, and order-book enabled.
4. Reported CLOB liquidity meets the minimum.
5. Current time is inside the configured entry window.
6. Oracle start/current prices exist and the snapshot is fresh.
7. Direction token exists and a distance threshold covers the current window.
8. Relative, absolute, and optional signal-consistency gates pass.
9. Ask exists, is fresh, below `1.00`, and inside the configured price floor/cap.
10. Spread exists and is within both target and hard limits.
11. Duplicate-round and risk stops are clear.
12. A finite, marketable, tick-aligned final limit price exists within the ask cap.
13. The notional at that final price produces at least the venue minimum number of shares.
14. Top ask depth covers `notionalUsd * depthMultiplier`.
15. Optional estimated-edge gate passes using the final limit price.

The result is `WAIT`, `SKIP`, or `ELIGIBLE`. `WAIT` is used when the same round may reasonably become eligible on a later fresh snapshot. `SKIP` means the current evaluation should not submit an order. Neither value authorizes a side effect.

## Output contract

`CryptoTailDecisionResult` carries the stable decision and reason code together with the candidate outcome/token, seconds to end, distance, required distance, heuristic win probability, estimated cost and edge, notional, and limit price when available. `buildCryptoTailGateDiagnostics` exposes individual `pass`, `fail`, or `pending` gates for UI and audit surfaces; the decision function remains authoritative.

An eligible decision can be converted into `CryptoTailEntryExecutionPlan`, which includes the strategy identity, entry order intent, cancellation timeout, chase bounds, and exit-policy values. Persist both the input and the manifest before any side effect. Namespace durable uniqueness by account, task, and round.

## Cost heuristic

For an ask probability `a`:

```text
estimatedAllInCost = a + 0.07 * a * (1 - a)
```

The second term is an explicit convex cost allowance. It is not a live fee quote and does not replace the venue's actual fee or slippage calculation.

## Win-probability heuristic

The model starts at `0.90`, adds a capped distance component, and adds a capped time component:

```text
distanceExcess = max(0, distanceBps - requiredDistanceBps)
distanceComponent = min(0.08, distanceExcess / 500)
estimatedWinProbability = min(0.99, 0.90 + distanceComponent + timeComponent)
```

For spot-like resolution, `timeComponent` follows a fixed seconds-to-end ladder. For TWAP resolution, it is proportional to the fraction of the settlement window already elapsed:

```text
lockedFraction = clamp(1 - secondsToEnd / windowSeconds, 0, 1)
timeComponent = 0.05 * lockedFraction
```

This estimate is a policy input, not a calibrated forecast. Users should validate it on their own data and market rules.

## Consistency gate

When enabled, the policy compares the reference lead with an optional live spot point. It rejects an entry when spot has moved past the lagging TWAP in the opposite direction by at least the configured contradiction threshold.

The gate is disabled in the reference preset. A missing spot point does not create a contradiction; hosts that require spot confirmation must enforce that requirement before calling the strategy.

## Limit-price and size policy

The eligible limit price begins at best ask. If `entryAskOffsetTicks > 0` and a positive tick size is available, the policy adds the configured ticks, rounds upward to a marketable tick, and floors the ask cap to the highest allowed tick. Minimum shares, estimated cost, and edge are then calculated from this final price.

The execution plan calculates shares as:

```text
shares = ceil(notionalUsd / limitPrice * 100) / 100
```

This is a two-decimal intent calculation. The host must apply venue precision, minimum-size, balance, and notional rules again immediately before submission.

## Chase policy

`evaluateCryptoTailChase` supports one bounded replacement decision. It rejects a chase when:

- the order was already chased;
- chasing is disabled;
- the original price or round end is unknown;
- less than one cancellation window remains; or
- the replacement price would exceed `askCap`.

The function returns a price decision only. Cancellation and replacement must be idempotent host operations with reconciliation between them.

## Exit policy

`evaluateCryptoTailExit` supports:

- **direction flip:** the current reference delta crosses to the opposite side of the round start;
- **distance collapse:** the current distance falls below a configured percentage of entry distance.

Stale/missing oracle data and an ended round return no exit command. This avoids manufacturing a price-based exit without a trusted snapshot; the host still owns settlement and emergency-stop behavior.

## Lifecycle reducer

`reduceCryptoTailLifecycle` is a pure reducer over order events. It can emit:

- `PLACE_ORDER`;
- `CANCEL_ORDER`;
- `STOP_NEW_ENTRIES`.

Commands are descriptions, not side effects. A host must persist event identity, deduplicate commands, submit through a venue adapter, and feed confirmed events back to the reducer. Partial exits remain open until cumulative exit shares cover the entered position. Invalid-state fills and cancellations, non-finite prices or shares, regressing cumulative fills, and exits above entered shares are ignored without mutating state or emitting commands.

## Reference configuration

`REFERENCE_CRYPTO_TAIL_CONFIG_V1` exists so examples, tests, and paper replays are reproducible. Its values are not a statement of current Virae production calibration and must not be interpreted as recommended thresholds.

## Host responsibilities

The host must resolve the exact market, confirm settlement/oracle equivalence, construct freshness assertions, load durable risk and duplicate-round state, and serialize submissions. Immediately before submission it must recheck the global live gate, venue state, tick/precision, minimum size, depth, balance, credentials, and jurisdictional controls. It must also persist ambiguous submit/cancel outcomes and reconcile them by durable identity before retrying.

## Known limitations

- The policy assumes binary Up/Down semantics and caller-verified market-rule equivalence.
- It does not estimate fill probability, queue position, latency, price impact beyond top-depth gating, or non-linear venue fees.
- It does not validate oracle provenance or detect manipulated/correlated data sources.
- The probability estimate is not statistically calibrated in this repository.
- Risk inputs are snapshots; the host must serialize or otherwise protect concurrent submissions.
- A deterministic replay proves reproducibility, not profitability.

The public package includes `fixtures/replay/crypto-tail-safety-v0.7.0.json`, which locks the eligible baseline, zero-distance fail-closed behavior, and final-price minimum-share behavior for host replay.

Changes to formulas, gate order, reason-code meaning, size rounding, or lifecycle transitions are behavior changes and require tests, changelog notes, and an appropriate version increment.
