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

1. Resolve the exact market and settlement rules.
2. Acquire round, oracle, and order-book data.
3. Validate timestamps and construct one immutable snapshot.
4. Load durable risk and duplicate-execution state.
5. Call `decideCryptoTailEntry`.
6. Persist the input schema/model version, decision, reason code, and trace ID.
7. If eligible, call `buildCryptoTailEntryExecutionPlan`.
8. Re-check global kill switches, geographic restrictions, credentials, balance, precision, and venue state.
9. Submit idempotently through a venue-specific adapter.
10. Persist the venue order ID and reconcile fills independently of the request path.

For Pre-M, call `buildPreMarketEntryPlan` once per task/account/round uniqueness scope. Persist all twelve intents before submission, submit each intent idempotently, and continue reconciling and cancelling even when new entries are disabled. After the take-profit delay, pass reconciled net open shares grouped from entry fills to `buildPreMarketTakeProfitIntents`; never pass requested shares or shares already sold.

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

Do not combine snapshots acquired at materially different times without recording their timestamps. A coherent snapshot is more important than calling the policy frequently.

## Persistence and observability

For every durable decision, record at least:

- trace ID and host release/commit;
- `CRYPTO_TAIL_STRATEGY_MANIFEST`;
- the applicable strategy manifest, including `PRE_MARKET_STRATEGY_MANIFEST` for Pre-M;
- package version from `@viraeai/virae-strategy-core/package.json`;
- strategy definition/profile and execution mode;
- round/market/token identifiers;
- decision and reason code;
- oracle timestamps/freshness and order-book timestamp/freshness;
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
