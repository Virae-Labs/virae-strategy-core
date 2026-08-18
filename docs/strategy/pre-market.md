# BTC 15-minute Pre-M dual ladder

## At a glance

| Item | Contract |
| --- | --- |
| Market | BTC 15-minute binary Up/Down round |
| Entry API | `buildPreMarketEntryPlan` |
| Entry output | Six BUY rungs for Up plus six BUY rungs for Down |
| Exit API | `buildPreMarketTakeProfitIntents` |
| Exit output | At most one fill-aware SELL intent per outcome |
| Modes | `SAFE`, `NORMAL`, and `AGGRESSIVE` |

## Scope

Pre-M is a deterministic execution contract for placing limit orders on both outcomes before a BTC 15-minute round opens. The package only creates order intents. Market discovery, persistence, signing, submission, cancellation, fill reconciliation, balance checks, risk limits, settlement, and recovery belong to the host.

`PRE_MARKET_STRATEGY_MANIFEST` identifies the policy as `polymarket-btc-15m-premarket-dual-ladder`, model `pre-m-live-v1`, input schema version 1, and execution policy version 1.

## Minimal usage

```ts
import {
  buildPreMarketEntryPlan,
  buildPreMarketTakeProfitIntents,
} from '@viraeai/virae-strategy-core/pre-market';

const entry = buildPreMarketEntryPlan({ round, config: { mode: 'NORMAL' } });
if (entry.ok) await host.persistEntryIntents(entry.intents);

const exits = buildPreMarketTakeProfitIntents({
  roundKey: round.roundKey,
  roundStartSec: round.roundStartSec,
  nowSec,
  positions: reconciledNetOpenPositions,
});
await host.persistTakeProfitIntents(exits);
```

The identifiers and host methods above are intentionally caller-defined. Calling these pure functions does not submit an order.

## Input and output contracts

Entry input contains a stable round key, start/end/current epoch seconds, market/accepting-order flags, and distinct canonical Up/Down token IDs. A successful `PreMarketEntryPlanResult` contains twelve intents plus one common cancellation deadline. Typed failures are `INVALID_ROUND`, `MARKET_UNAVAILABLE`, `TOKEN_IDS_MISSING`, `TOKEN_IDS_INVALID`, and `OUTSIDE_LAUNCH_WINDOW`.

Take-profit input contains the round identity and timing plus reconciled fill rows. Each row supplies outcome, token, filled shares, filled notional, and optional best ask. Invalid or internally inconsistent position data fails closed with no exit intents. This conservative empty-array result must be logged by the host; it must not be interpreted as proof that no position exists.

## Entry ladder

Each outcome receives the configured `sideBudgetUsd`, allocated over six rungs:

| Rung | Weight | Normal | Safe | Aggressive |
| --- | ---: | ---: | ---: | ---: |
| 1 | 23% | 0.40 | 0.36 | 0.44 |
| 2 | 23% | 0.30 | 0.27 | 0.33 |
| 3 | 17% | 0.24 | 0.22 | 0.27 |
| 4 | 14% | 0.18 | 0.17 | 0.20 |
| 5 | 12% | 0.12 | 0.11 | 0.14 |
| 6 | 11% | 0.06 | 0.06 | 0.07 |

Safe applies a `0.90` multiplier and Aggressive applies `1.10`. Adjusted prices are rounded upward to the next cent and clamped to `[0.01, 0.99]`. Entry notional is rounded to six decimal places. Informational shares are floored to two decimal places; a host that submits BUY by notional must treat `notionalUsd` as authoritative.

Entry is eligible from `roundStartSec - launchLeadSeconds` through `roundStartSec + launchGraceSeconds`, inclusive. The returned cancellation deadline is `roundStartSec + cancelAfterOpenSeconds`.

## Configuration

| Field | Default | Valid values |
| --- | ---: | --- |
| `mode` | `NORMAL` | `SAFE`, `NORMAL`, `AGGRESSIVE` |
| `sideBudgetUsd` | 10 | 10–100 USD |
| `launchLeadSeconds` | 240 | 30–600 whole seconds |
| `launchGraceSeconds` | 15 | 0–60 whole seconds |
| `cancelAfterOpenSeconds` | 20 | 20 or 40 seconds |
| `takeProfitDelaySeconds` | 300 | 0–900 whole seconds |
| `minimumTakeProfitPrice` | 0.60 | greater than 0 and less than 1 |
| `takeProfitMultiplier` | 2 | 1–10 |

Invalid configuration throws before any intent is returned. Invalid round identity, non-finite or reversed timestamps, unavailable markets, missing token IDs, and calls outside the launch window return a typed failure without intents.

## Take profit

After `roundStartSec + takeProfitDelaySeconds`, the package aggregates all supplied fills by outcome. All fills for one outcome must use the same token ID. The target is the maximum of:

- `minimumTakeProfitPrice`;
- volume-weighted average entry price multiplied by `takeProfitMultiplier`;
- the highest supplied valid best ask.

The target is rounded upward to a cent and capped at `0.99`. Sellable shares are floored to two decimals. A residual below `0.01` shares is treated as dust and produces no intent.

The host must supply reconciled **net open shares**. If a prior take-profit order filled partially or fully, subtract those executed shares before calling the function again. The package does not query orders or balances and cannot infer residual exposure.

## Idempotency and lifecycle

Entry keys are stable within a round: `<roundKey>:ENTRY:<OUTCOME>:<RUNG>`. Take-profit keys are `<roundKey>:TAKE_PROFIT:<OUTCOME>`. If a database uniqueness boundary spans users, accounts, or tasks, namespace these keys with that durable host identifier.

A production host should:

1. validate venue tick, minimum size, balance, market state, and live-trading gates immediately before submission;
2. persist intents before calling the venue;
3. recover ambiguous submissions by durable intent identity instead of blind retry;
4. reconcile every rung independently and cancel remaining open entry orders at the deadline;
5. aggregate confirmed fills into net open positions before creating take-profit orders;
6. keep reconciliation and exits active when new entries or the global live gate are disabled.

## Limitations

The ladder and take-profit multiplier are explicit heuristics, not probability estimates or profitability guarantees. The strategy does not model queue priority, slippage, fees, adverse selection, settlement-rule mismatch, or cross-outcome capital netting. Replay and shadow evidence for the exact package and host versions is required before enabling real funds.
