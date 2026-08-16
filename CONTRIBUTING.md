# Contributing

Thanks for helping improve Virae Strategy Core.

## Development setup

Requirements:

- Node.js 20 or newer;
- npm with lockfile support;
- no exchange credentials or production data.

```bash
git clone https://github.com/Virae-Labs/virae-strategy-core.git
cd virae-strategy-core
npm ci
npm run check
```

## Design rules

- Keep the library deterministic and side-effect free.
- Do not add network, database, wallet, signing, environment-variable, timer, or process-global dependencies to strategy functions.
- Treat inputs as immutable and return serializable values.
- Fail closed on missing or stale safety-critical data.
- Preserve stable reason codes unless the behavior change is intentional and documented.
- Keep venue-specific execution and credentials outside this repository.
- Do not include private production thresholds, keys, user data, or proprietary datasets in issues, fixtures, or commits.

## Pull requests

Keep changes focused. A behavior-changing pull request should include:

- the problem and intended policy change;
- affected manifest/model/execution versions;
- boundary-focused unit tests;
- an integration or replay fixture when multiple stages are affected;
- documentation and changelog updates;
- old/new output comparison for representative fixtures;
- an explicit statement about compatibility and rollout risk.

Run before opening a pull request:

```bash
npm run check
npm run test:coverage
npm pack --dry-run
```

## Versioning

The project is currently in the `0.x` phase. Versions are still immutable once published.

- Patch: documentation, tests, metadata, and compatible fixes.
- Minor: intentional public API or strategy behavior additions during `0.x`.
- Major: reserved for stable-contract breaking changes after `1.0.0`.

Independently increment manifest fields when their meaning changes:

- `inputSchemaVersion` for incompatible normalized input changes;
- `executionPolicyVersion` for order-plan/chase/exit execution semantics;
- `modelVersion` for entry model/formula/gate behavior.

## Reporting security issues

Do not disclose exploitable execution or credential-handling issues in a public issue. Follow [SECURITY.md](./SECURITY.md).
