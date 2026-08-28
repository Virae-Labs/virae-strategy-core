# Changelog

All notable changes to this project are documented here. The project follows semantic versioning while remaining in the `0.x` development phase.

## Unreleased

## 0.10.2 - 2026-08-28

- Republish the 0.10.1 Memecoin Momentum Guard calibration from an aligned Git release commit and tag; strategy behavior is unchanged.

## 0.10.1 - 2026-08-28

- Calibrate Conservative, Balanced, and Aggressive Memecoin Momentum Guard thresholds against the current Solana P2 candidate distribution.
- Add fail-closed Top-10 holder concentration inputs and profile-specific concentration limits.

## 0.10.0 - 2026-08-27

- Add a versioned Conservative, Balanced, and Aggressive parameter matrix for task-independent Memecoin Momentum Guard forward simulations.
- Export profile lookup contracts without adding host I/O to the strategy package.

## 0.9.0 - 2026-08-27

- Add the deterministic Solana Memecoin Momentum Guard strategy with persistent momentum, activity, security, risk-budget, and executable-quote entry gates.
- Add executable-proceeds-based take-profit, stop-loss, risk-stop, and maximum-hold exit decisions.
- Add a 15-row entry/quote/risk/exit replay matrix, public package subpath, catalog metadata, integration guidance, and clean-consumer packaging coverage.

## 0.8.1 - 2026-08-26

- Treat decimal spread values within a sub-tick floating-point epsilon as equal to Crypto Tail spread limits, keeping decision results and gate diagnostics consistent at exact price-tick boundaries.

## 0.8.0 - 2026-08-26

- **Breaking:** replace the public `ev-snipe` package subpath, symbols, Skill operations, and catalog key with the canonical `hit-price-snipe` contract. No compatibility export is retained.
- Add a venue-aware BTC 15m Value Snipe decision contract, deterministic Polymarket and Predict.fun system simulation matrices, and an explicit host-execution-supported manifest boundary.
- Require hosts to supply explicit executable all-in cost so venue fees and slippage are never silently shared or guessed across platforms.
- Add focused strategy documentation, API/integration/testing guidance, consumer packaging coverage, and bundled Skill operations for both canonical Snipe families.

## 0.7.0 - 2026-08-24

- Fail closed on non-finite Crypto Tail market, oracle, risk, configuration, execution-plan, and chase inputs with typed reason codes.
- Prevent zero-distance Crypto Tail snapshots from inferring an Up signal or receiving the heuristic time confidence boost.
- Resolve the final tick-aligned entry price before minimum-share, fee, and edge checks; prevent off-grid ask caps from producing off-grid order intents.
- Enforce the configured Crypto Tail task profit stop and harden lifecycle transitions against invalid, out-of-order, regressing, and overfilled events.
- Validate Musk tweet-count counters, remaining time, rates, ranges, order books, and entry configuration before evaluating a trade.
- Generate Crypto Tail hosted profile keys from the manifest registry and publish a versioned Crypto Tail safety replay corpus.
- Make the npm release workflow idempotent only when an existing registry version records the exact release commit.
- Bump the Crypto Tail model to `heuristic-v3-twap`, input schema to `2`, and execution policy to `2`.

## 0.6.0 - 2026-08-18

- Expand the Crypto Tail host catalog and documented profile boundary so SOL, DOGE, XRP, and BNB are supported at 1 hour as well as 15 minutes.

## 0.5.0 - 2026-08-18

- Expand the Crypto Tail manifest and public contract to support SOL, DOGE, XRP, and BNB 15-minute Up/Down rounds.
- Retain BTC and ETH support for both 15-minute and 1-hour profiles while documenting the asset-specific interval boundary.

## 0.4.0 - 2026-08-18

- Add a simulation-only EV Snipe strategy contract with source-equivalent hit detection, explicit Confirm-hit and Pre-hit semantics, freshness/price/edge gates, deterministic FAK intents, and fee-aware fill/settlement simulation.
- Add a system-level EV Snipe matrix spanning trigger boundaries, data quality, execution outcomes, economics, and Pre-hit safety, without adding live discovery, feeds, persistence, or order submission.
- Fail closed on excessive source transport latency and invalid fee models, expose source latency in decisions, and apply the venue's documented five-decimal protocol-fee precision.

## 0.3.0

- Add the deterministic Weather Temperature decision, configuration, manifest, catalog, replay, and order-intent contract.
- Keep weather data collection, live risk controls, and order submission outside the package execution boundary.
- Fail closed on unconfigured stations, malformed date/timezone/metric/candidate/config values, non-finite prices/probabilities, unavailable venue minimum size, and undersized selected legs.
- Preserve the exact event budget in integer cents for adjacent TOP2 and expose Weather evaluation/replay through the bundled Skill.
- Expand the README, all strategy guides, public API, integration contract, testing, and release documentation for the four-strategy catalog.

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
