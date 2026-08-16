# Changelog

All notable changes to this project are documented here. The project follows semantic versioning while remaining in the `0.x` development phase.

## Unreleased

## 0.2.0 - 2026-08-16

- Move Musk tweet-count types, configuration, decisions, snapshot selection, and pure risk-stop policy from Polybot into the core package.
- Add a deterministic current/next-market selector and stable Musk intent keys with a 1,000 USD live task-budget default.
- Fail closed on stale selected orderbooks, stale next-market counters, and malformed timestamps; exclude `115+` from high-tail selection and apply task loss stops across sizing modes.
- Add the `/musk-tweet-count` export, strategy catalog entry, tests, documentation, and AI Skill operations.
- Change the project license from Apache-2.0 to CPAL-1.0 with required Virae attribution and URL display.

## 0.1.0 - 2026-08-16

- Add deterministic BTC 15-minute Pre-M dual-ladder entry and take-profit execution contracts.
- Add stable per-round intent keys for idempotent live execution.

## 0.0.2 - 2026-08-16

### Added

- Expanded public documentation for strategy behavior, API, integration safety, testing, contribution, and security.
- Public package consumer and end-to-end lifecycle test layers.
- CI coverage for supported Node.js versions and npm package installation.

### Changed

- Improved npm metadata, export discoverability, and package contents.

## 0.0.1 - 2026-08-16

### Added

- Deterministic Crypto Tail entry decisions and gate diagnostics.
- Entry execution plans, bounded chase policy, and exit evaluation.
- Pure order lifecycle reducer with partial/residual fill handling.
- Versioned manifest and runnable reference configuration.
- Root and `/crypto-tail` CommonJS exports with TypeScript declarations.
