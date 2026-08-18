# Testing and replay

## Test layers

The repository uses four complementary layers:

1. **Unit tests** cover every strategy's decision gates, calculations, execution policy, exit policy, and lifecycle transitions.
2. **Contract tests** verify the public root and subpath exports, manifest identity, and compatibility aliases.
3. **Integration tests** run a complete snapshot → decision → plan → fill → exit lifecycle without side effects.
4. **Package e2e** builds and packs the npm artifact, installs it into a temporary consumer, loads it through CommonJS and ESM, and compiles downstream TypeScript against the installed declarations.

The Musk integration corpus additionally proves that the 1,000 USD default can produce a current-market intent, stale counter/orderbook data cannot produce an executable intent, malformed times return typed invalid-input results, the `115+` range is not selected as high-tail, deterministic replay is deeply equal, and the bundled AI Skill executes the installed package rather than copied logic.

The Weather unit and package corpus covers station/date/timezone identity, forecast health, malformed numeric values, stale/unavailable quotes, venue minimum size, exact cent allocation for adjacent TOP2, deterministic intent keys, normalization fallbacks, focused subpath exports, and bundled Skill execution.

The EV Snipe corpus is a system-level executable matrix. It covers exact up/down strike boundaries, no crossing, source/symbol mismatch, delayed source transport, stale trigger/quote, market-window rejection, maximum price and fee-adjusted edge, FAK full/partial/no-fill, winning/losing resolution, invalid fee models, and Pre-hit probability/cutoff rules. The matrix is deterministic and side-effect free; host integration tests should replay the same serialized rows after normalization.

## Commands

```bash
npm run test:unit
npm run test:contract
npm run test:integration
npm run test:e2e
npm run test:coverage
npm run check
```

`npm run check` is the local pre-commit quality gate. CI executes the same behavior on supported Node versions.

## Adding behavior tests

For a decision change, add cases for:

- the value immediately below the boundary;
- the exact boundary;
- the value immediately above the boundary;
- missing, stale, zero, negative, and non-finite inputs where applicable;
- both Up and Down directions;
- stable decision and reason-code output;
- mutation safety when caller-owned arrays or objects are used.

For lifecycle changes, test accepted, partial, filled, cancelled, retried, residual, stopped, settled, and failed paths. Commands must be asserted separately from state.

## Replay contract

A useful replay fixture contains:

- manifest and package version;
- normalized input snapshot;
- expected decision/reason code;
- expected order intent, if any;
- ordered lifecycle events;
- expected terminal state and commands.

For EV Snipe, also include canonical source identity, exchange/receive/evaluation timestamps, executable quote depth, effective fee rates, actual fill price/notional, and binary resolution. Do not infer profitability from decision eligibility alone.

Avoid relying on wall-clock time, network calls, random IDs, or mutable global configuration. Replaying the same fixture against the same package version must produce a deeply equal result.

Before a behavior release, compare the old and new package over a fixed corpus and explicitly review every changed decision, reason code, price, size, and transition.

## Coverage policy

Coverage thresholds in `jest.config.cjs` prevent large untested regressions. Coverage is a floor, not evidence that a trading policy is correct. Boundary tests, replay fixtures, and host integration tests remain mandatory.
