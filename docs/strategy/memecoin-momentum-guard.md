# Memecoin Momentum Guard

Hosts can use `MEMECOIN_MOMENTUM_GUARD_PROFILES` for comparable forward simulations. The exported matrix contains `conservative`, `balanced`, and `aggressive` profiles; each is a complete immutable configuration evaluated by the same entry and exit functions as the default strategy.

The forward-simulation pair-age floors are three, two, and one hour respectively. Their activity and liquidity floors are intentionally broader than the live default so the host can collect comparative forward evidence. Missing risk-level, honeypot, and Top-10 holder evidence passes through to the remaining entry gates; explicit high-risk, honeypot, and excessive concentration values still reject entry. Quote freshness, sellability, impact, exposure, and daily-loss gates remain fail-closed.

Memecoin Momentum Guard is a deterministic Solana strategy contract for a host-provided dynamic token universe. It does not discover tokens or call a quote provider. It evaluates one normalized observation and one executable quote at a caller-provided time.

## Entry contract

The default profile requires:

- a pair at least four hours old;
- fresh observations with at least USD 25,000 liquidity, USD 25,000 trailing 24-hour volume, and 100 trailing transactions;
- one-hour price momentum between 3% and 35%;
- a momentum-breakout signal plus volume-surge or buy-pressure confirmation;
- at least two continuous signal observations, 1.4x hourly volume anomaly, and buy participation between 50% and 90%;
- known Top-10 holder concentration no higher than 40%;
- known non-honeypot security evidence, active DEX state, and a host-confirmed buy route;
- a fresh executable quote with verified sellability, no more than 3% impact, no more than 0.5% order-to-pool ratio, and at least 15 seconds of remaining validity;
- task open-position, cooldown, daily notional, and realized-loss limits.

`ELIGIBLE` is not authorization to submit. The host must create a durable unique claim, re-read the task and risk state, revalidate the quote and balance, and only then execute through its venue adapter.

## Exit contract

Exit evaluation uses host-supplied executable sell proceeds, never a display spot price. The default profile emits `EXIT` for:

- 20% take profit;
- 8% stop loss;
- a fresh risk warning;
- a two-hour maximum holding time.

Missing sell routes fail closed. Missing executable proceeds return `HOLD / SELL_QUOTE_REQUIRED`; the host must retry within a bounded monitored lifecycle rather than treating the position as protected.

## Data and safety boundary

The host owns discovery, source freshness, security-provider semantics, quote construction, wallets, signing, idempotency, submission, chain confirmation, PnL accounting, fee accounting, scheduling, monitoring, geographic controls, and kill switches. Unknown broadcast outcomes must be reconciled before retry.

The default thresholds are explicit experimental parameters, not profitability claims. Collect survivorship-safe observations and executable quotes, run the deterministic matrix through the host adapter, and validate Paper evidence before enabling real funds.
