# Memecoin Launch Scout

Memecoin Launch Scout is a deterministic, side-effect-free contract for small entries into newly launched Solana pools. The host owns discovery, enrichment, quotes, durable claims, wallet custody, transaction submission, reconciliation, and alerts.

## Entry contract

`decideMemecoinLaunchEntry()` only returns `ELIGIBLE` when the pool is inside the configured launch-age window, the observation is fresh, five-minute activity and buy share pass, the token security and holder evidence are available and acceptable, task risk budgets remain open, and a fresh executable buy plus reverse-sell quote passes impact, pool-ratio, liquidity, and sellability gates.

Missing risk-level, honeypot, Top-10 holder, or developer-holder evidence passes through to the remaining entry gates. Explicit high-risk, honeypot, or excessive holder values still reject entry. Missing quote evidence continues to wait. A new pool can return `WAIT`; a pool older than the launch window is permanently skipped for that observation.

## Exit contract

`decideMemecoinLaunchExit()` uses executable proceeds after the host's quoted route costs. It exits on a risk warning, fixed take profit, fixed stop loss, a smaller positive return after `minHoldSec`, or `maxHoldSec`. The time stop exits even when the position is losing; the strategy never turns an expired lottery position into an indefinite holding.

## Profiles and system matrix

`MEMECOIN_LAUNCH_SCOUT_PROFILES` exports Conservative, Balanced, and Aggressive forward-simulation configurations. `buildMemecoinLaunchScoutSystemSimulationMatrix()` returns 21 deterministic entry, data-quality, risk, quote, and exit scenarios. Hosts should replay the exact installed matrix through their normalization adapter and persist the package/model version with results before enabling live execution.

The forward-simulation launch windows are 2–30 minutes, 1–45 minutes, and 30 seconds–60 minutes respectively. Participation and liquidity floors are broadened for evidence collection. Available holder, developer-holding, and honeypot evidence is enforced, while missing values pass through. Quote freshness, sellability, impact, exposure, and daily-loss checks remain fail-closed.
