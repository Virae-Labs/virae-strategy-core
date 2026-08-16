# Testing and replay

## Test layers

The repository uses four complementary layers:

1. **Unit tests** cover every strategy's decision gates, calculations, execution policy, exit policy, and lifecycle transitions.
2. **Contract tests** verify the public root and subpath exports, manifest identity, and compatibility aliases.
3. **Integration tests** run a complete snapshot → decision → plan → fill → exit lifecycle without side effects.
4. **Package e2e** builds and packs the npm artifact, installs it into a temporary consumer, loads it through CommonJS and ESM, and compiles downstream TypeScript against the installed declarations.

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

Avoid relying on wall-clock time, network calls, random IDs, or mutable global configuration. Replaying the same fixture against the same package version must produce a deeply equal result.

Before a behavior release, compare the old and new package over a fixed corpus and explicitly review every changed decision, reason code, price, size, and transition.

## Coverage policy

Coverage thresholds in `jest.config.cjs` prevent large untested regressions. Coverage is a floor, not evidence that a trading policy is correct. Boundary tests, replay fixtures, and host integration tests remain mandatory.
