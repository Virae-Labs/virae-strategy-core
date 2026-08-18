# Integration guide

## Architecture boundary

The package sits between normalized data and an execution host:

```text
market/oracle/risk adapters
          |
          v
  normalized snapshot
          |
          v
 strategy-core (pure)
          |
          v
 decision / order intent / lifecycle command
          |
          v
 host validation, persistence, venue execution, reconciliation
```

The package is synchronous and side-effect free. It is safe to run in workers, APIs, simulations, and replay tools as long as the caller provides the same normalized input.

## Recommended flow

1. Resolve the exact market, outcome mapping, and settlement rules.
2. Acquire the strategy-specific market, oracle/counter/forecast, and order-book data.
3. Validate timestamps and construct one immutable snapshot.
4. Load durable risk and duplicate-execution state.
5. Normalize configuration and call the strategy's primary decision or plan API.
6. Persist the package/manifest versions, normalized input, effective config, decision, reason code, and trace ID.
7. Convert an eligible decision to an execution plan when the strategy exposes a separate planning step.
8. Re-check global kill switches, geographic restrictions, credentials, balance, precision, and venue state.
9. Claim every intent through a concurrency-safe durable idempotency boundary.
10. Submit through a venue adapter, persist the venue order identity, and reconcile independently of the request path.

For Pre-M, call `buildPreMarketEntryPlan` once per task/account/round uniqueness scope. Persist all twelve intents before submission, submit each intent idempotently, and continue reconciling and cancelling even when new entries are disabled. After the take-profit delay, pass reconciled net open shares grouped from entry fills to `buildPreMarketTakeProfitIntents`; never pass requested shares or shares already sold.

For Musk tweet count, normalize one coherent active snapshot and optional earliest upcoming snapshot, then call `decideMuskTweetCountEntry` with an explicit `nowSec`. Treat `selectedIntent.status === 'generated'` as a candidate only after rechecking both counter and selected-orderbook timestamps, task/global risk, balance, venue minimum size, and deduplication state. Persist `currentEvaluation`, `nextEvaluation`, `reasonCode`, manifest, effective 1,000 USD task-budget basis or lower host cap, and the selected snapshot identity. Never submit a rejected candidate returned for audit.

For Weather Temperature, verify the settlement station, timezone, temperature unit, target local date, metric, official resolution source, and bucket inclusivity before constructing probabilities. Call `decideWeatherTemperatureEntry` with the normalized entry config and explicit `nowSec`. Persist the forecast run key, ensemble health, candidate probabilities, quote timestamps, evaluations, diagnostics, and manifest. Recheck the selected quotes immediately before submission. For adjacent TOP2, claim the group before either leg, reconcile both independently, and define recovery for a partial group; venue execution is not atomic.

## Minimal host adapter

```ts
import {
  buildCryptoTailEntryExecutionPlan,
  CRYPTO_TAIL_STRATEGY_MANIFEST,
  decideCryptoTailEntry,
  type CryptoTailDecisionInput,
} from '@viraeai/virae-strategy-core/crypto-tail';

async function evaluateAndMaybeSubmit(input: CryptoTailDecisionInput) {
  const decision = decideCryptoTailEntry(input);

  await audit.write({
    traceId,
    strategy: CRYPTO_TAIL_STRATEGY_MANIFEST,
    decision: decision.decision,
    reasonCode: decision.reasonCode,
  });

  const planned = buildCryptoTailEntryExecutionPlan({
    decision,
    config: input.config,
  });
  if (!planned.ok) return { submitted: false, decision };

  await safety.assertTradingEnabled();
  await safety.assertFreshSnapshot(input);
  await safety.assertNoExistingRoundOrder(input.round?.roundKey);
  await safety.assertVenueRules(planned.plan.order);
  await safety.assertAvailableBalance(planned.plan.order.notionalUsd);

  const order = await venue.submitLimitOrder({
    idempotencyKey: `${accountId}:${input.round?.roundKey}:ENTRY`,
    ...planned.plan.order,
  });
  return { submitted: true, decision, order };
}
```

The identifiers in this example are intentionally host-defined. Never use a random retry key for money-moving calls; retries must resolve to the same durable intent.

## Data normalization

- Use seconds for `nowSec`, `roundStartSec`, `roundEndSec`, and oracle point timestamps.
- Use probability prices in `[0, 1]` for asks, bids, and limit prices.
- Use USD-like display units for notional and depth fields.
- Set freshness booleans only after comparing timestamps with a documented host threshold.
- Map outcome labels to the canonical `Up` and `Down` token IDs.
- Confirm that the oracle and market settlement rule refer to the same asset, quote currency, window, and cutoff.
- For Musk, normalize counter ranges and compare counter/orderbook timestamps using explicit host thresholds.
- For Weather, use the settlement station's IANA timezone and strict local target date; verify forecast units, metric, bucket bounds, and resolution-source equivalence.

Do not combine snapshots acquired at materially different times without recording their timestamps. A coherent snapshot is more important than calling the policy frequently.

## Persistence and observability

For every durable decision, record at least:

- trace ID and host release/commit;
- `CRYPTO_TAIL_STRATEGY_MANIFEST`;
- the applicable strategy manifest, including `PRE_MARKET_STRATEGY_MANIFEST` for Pre-M;
- `MUSK_TWEET_COUNT_STRATEGY_MANIFEST` and selector reason for Musk tweet-count decisions;
- `WEATHER_TEMPERATURE_STRATEGY_MANIFEST`, forecast run key, station, target date, metric, and decision diagnostics for Weather Temperature;
- package version from `@viraeai/virae-strategy-core/package.json`;
- strategy definition/profile and execution mode;
- round/market/token identifiers;
- decision and reason code;
- oracle timestamps/freshness and order-book timestamp/freshness;
- counter or forecast capture/run identity and host freshness calculation when applicable;
- calculated distance, probability, cost, edge, price, and size;
- effective configuration and risk snapshot;
- venue order ID and reconciliation state, when applicable.

Never log private keys, signatures, authorization headers, session tokens, or unrestricted upstream payloads.

## Production safety checklist

Before connecting the package to real funds, verify:

- [ ] package version is exact and lockfile integrity is committed;
- [ ] market-rule and oracle-rule equivalence is explicitly checked;
- [ ] stale, partial, malformed, and cross-round snapshots fail closed;
- [ ] a global kill switch is checked immediately before submission;
- [ ] user/account/strategy risk limits are durable and concurrency-safe;
- [ ] duplicate round execution is prevented with a durable uniqueness boundary;
- [ ] venue precision, tick, minimum-size, price, and balance rules are revalidated;
- [ ] submit/cancel/replace operations are idempotent;
- [ ] timeouts do not imply that an order failed—reconciliation resolves unknown outcomes;
- [ ] partial fills and residual positions are represented explicitly;
- [ ] Pre-M entry rungs are persisted independently and take-profit input uses reconciled net open shares;
- [ ] Musk current/next counter freshness and selected-orderbook freshness are rechecked immediately before submission;
- [ ] Musk intent keys are namespaced by account, task, and market lifecycle before durable deduplication;
- [ ] Weather station/timezone/date/unit/metric and official resolution rules are verified before probability construction;
- [ ] Weather forecast run and quote freshness are recorded, and TOP2 group claims/partial execution recovery are tested;
- [ ] every state-changing action has a traceable audit event;
- [ ] paper replay and canary/shadow evidence exists for the exact version;
- [ ] rollback means restoring both host code and the exact prior package version;
- [ ] operators can disable new entries without preventing reconciliation or exits.

## Upgrade procedure

1. Read `CHANGELOG.md` and compare manifest versions.
2. Install the new version exactly.
3. Run the host's compile and strategy adapter tests.
4. Replay a fixed corpus through old and new versions.
5. Classify every decision, reason-code, price, size, and lifecycle difference.
6. Run paper/shadow traffic before enabling new live entries.
7. Keep the prior package version and deployment artifact available for rollback.

Do not allow two package versions to make concurrent decisions for the same durable strategy instance unless the experiment boundary is explicit and neither path can double-submit.
