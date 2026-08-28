import type { MemecoinLaunchEntryDecision, MemecoinLaunchEntryInput, MemecoinLaunchEntryReasonCode, MemecoinLaunchExitDecision, MemecoinLaunchExitInput } from './types';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function entryResult(input: MemecoinLaunchEntryInput | null | undefined, decision: MemecoinLaunchEntryDecision['decision'], reasonCode: MemecoinLaunchEntryReasonCode, reasonMessage: string, extras: Partial<MemecoinLaunchEntryDecision> = {}): MemecoinLaunchEntryDecision {
  const buys = input?.observation?.buys5m; const sells = input?.observation?.sells5m;
  const buySharePct = finite(buys) && finite(sells) && buys + sells > 0 ? buys / (buys + sells) * 100 : null;
  const pairAgeSec = finite(input?.nowSec) && finite(input?.observation?.pairCreatedAtSec) ? input.nowSec - input.observation.pairCreatedAtSec : null;
  return { decision, reasonCode, reasonMessage, decisionKey: null, tokenAddress: input?.observation?.tokenAddress ?? null, quoteKey: input?.quote?.quoteKey ?? null, notionalUsd: null, pairAgeSec, buySharePct, ...extras };
}

function validConfig(input: MemecoinLaunchEntryInput): boolean {
  const c = input.config;
  return Object.values(c).every(finite) && c.minPairAgeSec >= 0 && c.maxPairAgeSec >= c.minPairAgeSec
    && c.maxObservationAgeSec >= 0 && c.minLiquidityUsd > 0 && c.minVolume5mUsd >= 0
    && c.minTxns5m >= 0 && c.minBuys5m >= 0 && c.minBuySharePct >= 0 && c.minBuySharePct <= 100
    && c.maxPriceChange5mPct > 0 && c.maxTop10HolderPct >= 0 && c.maxTop10HolderPct <= 100
    && c.maxDevHolderPct >= 0 && c.maxDevHolderPct <= 100 && c.maxQuoteAgeSec >= 0
    && c.minQuoteValidityRemainingSec >= 0 && c.maxPriceImpactPct >= 0 && c.maxOrderPoolRatioPct > 0
    && c.perOrderNotionalUsd > 0 && c.maxOpenPositions >= 1 && c.maxDailyNotionalUsd >= c.perOrderNotionalUsd
    && c.maxDailyLossUsd > 0 && c.takeProfitPct > 0 && c.minHoldSec >= 0 && c.minProfitAfterHoldPct >= 0
    && c.stopLossPct > 0 && c.maxHoldSec >= c.minHoldSec;
}

export function decideMemecoinLaunchEntry(input: MemecoinLaunchEntryInput): MemecoinLaunchEntryDecision {
  const o = input?.observation; const r = input?.risk;
  if (!o || !r || !finite(input?.nowSec) || !validConfig(input) || o.venue !== 'SOLANA' || o.chainId !== 'solana-mainnet'
    || !o.observationId || !o.tokenAddress) return entryResult(input, 'SKIP', 'INVALID_INPUT', 'A valid Solana launch observation, risk state, time, and configuration are required.');
  const values = [o.capturedAtSec, o.pairCreatedAtSec, o.priceUsd, o.priceChange5mPct, o.volume5mUsd, o.txns5m, o.buys5m, o.sells5m, o.liquidityUsd, r.openPositionCount, r.dailyExecutedNotionalUsd, r.dailyRealizedPnlUsd];
  if (!values.every(finite) || o.priceUsd <= 0 || [o.volume5mUsd, o.txns5m, o.buys5m, o.sells5m, o.liquidityUsd, r.openPositionCount, r.dailyExecutedNotionalUsd].some((value) => value < 0)) return entryResult(input, 'SKIP', 'INVALID_INPUT', 'Launch and risk metrics must be finite and non-negative.');
  if (!r.globallyEnabled) return entryResult(input, 'SKIP', 'STRATEGY_DISABLED', 'The host strategy gate is disabled.');
  if (input.nowSec - o.capturedAtSec > input.config.maxObservationAgeSec || o.capturedAtSec > input.nowSec + 1) return entryResult(input, 'SKIP', 'OBSERVATION_STALE', 'The launch observation is stale or from the future.');
  const age = input.nowSec - o.pairCreatedAtSec;
  if (age < input.config.minPairAgeSec) return entryResult(input, 'WAIT', 'PAIR_TOO_NEW', 'The pool is still inside the initial discovery delay.');
  if (age > input.config.maxPairAgeSec) return entryResult(input, 'SKIP', 'PAIR_TOO_OLD', 'The pool is outside the configured launch window.');
  if (o.riskLevel === 'UNKNOWN' || o.honeypot == null) return entryResult(input, 'SKIP', 'SECURITY_UNAVAILABLE', 'Required token security evidence is unavailable.');
  if (o.riskLevel === 'HIGH' || o.honeypot) return entryResult(input, 'SKIP', 'SECURITY_REJECTED', 'Token security checks rejected entry.');
  if (o.top10HolderPct == null || o.devHolderPct == null) return entryResult(input, 'SKIP', 'HOLDER_DATA_UNAVAILABLE', 'Top-holder and developer-holder evidence is required.');
  if (![o.top10HolderPct, o.devHolderPct].every(finite) || o.top10HolderPct < 0 || o.top10HolderPct > 100 || o.devHolderPct < 0 || o.devHolderPct > 100) return entryResult(input, 'SKIP', 'INVALID_INPUT', 'Holder percentages must be between 0 and 100.');
  if (o.top10HolderPct > input.config.maxTop10HolderPct) return entryResult(input, 'SKIP', 'HOLDER_CONCENTRATION_TOO_HIGH', 'Top-10 holder concentration exceeds the limit.');
  if (o.devHolderPct > input.config.maxDevHolderPct) return entryResult(input, 'SKIP', 'DEV_HOLDING_TOO_HIGH', 'Developer holding exceeds the limit.');
  if (o.dexStatus !== 'active') return entryResult(input, 'SKIP', 'DEX_INACTIVE', 'Indexed DEX activity is not active.');
  if (!o.buyEnabled) return entryResult(input, 'SKIP', 'BUY_ROUTE_UNAVAILABLE', 'No executable buy route is available.');
  if (o.liquidityUsd < input.config.minLiquidityUsd) return entryResult(input, 'SKIP', 'LIQUIDITY_TOO_LOW', 'Pool liquidity is below the floor.');
  if (o.volume5mUsd < input.config.minVolume5mUsd || o.txns5m < input.config.minTxns5m || o.buys5m < input.config.minBuys5m) return entryResult(input, 'WAIT', 'EARLY_ACTIVITY_TOO_LOW', 'Five-minute launch participation is below the entry floor.');
  const base = entryResult(input, 'WAIT', 'BUY_PRESSURE_TOO_LOW', 'Five-minute buy participation is below the configured share.');
  if (base.buySharePct == null || base.buySharePct < input.config.minBuySharePct) return base;
  if (o.priceChange5mPct > input.config.maxPriceChange5mPct) return entryResult(input, 'SKIP', 'LAUNCH_OVERHEATED', 'The five-minute move exceeds the chase ceiling.');
  if (r.openPositionCount >= input.config.maxOpenPositions) return entryResult(input, 'SKIP', 'POSITION_LIMIT_REACHED', 'The task reached its open-position limit.');
  if (r.dailyExecutedNotionalUsd + input.config.perOrderNotionalUsd > input.config.maxDailyNotionalUsd) return entryResult(input, 'SKIP', 'DAILY_NOTIONAL_LIMIT_REACHED', 'This entry would exceed the daily notional limit.');
  if (r.dailyRealizedPnlUsd <= -input.config.maxDailyLossUsd) return entryResult(input, 'SKIP', 'DAILY_LOSS_LIMIT_REACHED', 'The daily realized loss stop is active.');
  if (r.tokenCooldownUntilSec != null && (!finite(r.tokenCooldownUntilSec) || r.tokenCooldownUntilSec > input.nowSec)) return entryResult(input, 'SKIP', finite(r.tokenCooldownUntilSec) ? 'TOKEN_COOLDOWN_ACTIVE' : 'INVALID_INPUT', finite(r.tokenCooldownUntilSec) ? 'The token cooldown is active.' : 'Token cooldown must be finite.');
  const q = input.quote;
  if (!q) return entryResult(input, 'WAIT', 'QUOTE_REQUIRED', 'An executable round-trip quote is required.');
  if (!q.quoteKey || ![q.createdAtSec, q.expiresAtSec, q.estimatedNotionalUsd].every(finite)) return entryResult(input, 'SKIP', 'INVALID_INPUT', 'Quote identity, timestamps, and notional are required.');
  if (input.nowSec - q.createdAtSec > input.config.maxQuoteAgeSec || q.createdAtSec > input.nowSec + 1) return entryResult(input, 'WAIT', 'QUOTE_STALE', 'The executable quote is stale or from the future.');
  if (q.expiresAtSec - input.nowSec < input.config.minQuoteValidityRemainingSec) return entryResult(input, 'WAIT', 'QUOTE_EXPIRING', 'The executable quote expires too soon.');
  if (![q.priceImpactPct, q.orderPoolRatioPct, q.poolLiquidityUsd].every(finite)) return entryResult(input, 'SKIP', 'QUOTE_METRICS_UNAVAILABLE', 'Price impact, pool ratio, and quote liquidity are required.');
  if (q.priceImpactPct! > input.config.maxPriceImpactPct) return entryResult(input, 'SKIP', 'PRICE_IMPACT_TOO_HIGH', 'Executable price impact exceeds the limit.');
  if (q.orderPoolRatioPct! > input.config.maxOrderPoolRatioPct) return entryResult(input, 'SKIP', 'ORDER_POOL_RATIO_TOO_HIGH', 'Order size is too large relative to the pool.');
  if (q.poolLiquidityUsd! < input.config.minLiquidityUsd) return entryResult(input, 'SKIP', 'LIQUIDITY_TOO_LOW', 'Quote-time liquidity is below the floor.');
  if (q.sellability !== 'VERIFIED') return entryResult(input, 'SKIP', 'SELLABILITY_UNVERIFIED', 'Sellability must be verified before buying.');
  if (Math.abs(q.estimatedNotionalUsd - input.config.perOrderNotionalUsd) > 0.01) return entryResult(input, 'SKIP', 'INVALID_INPUT', 'Quote notional does not match the configured order.');
  return entryResult(input, 'ELIGIBLE', 'ENTRY_READY', 'Launch age, activity, security, risk, and executable quote gates passed.', { decisionKey: `${o.venue}:${o.tokenAddress}:${o.observationId}`, quoteKey: q.quoteKey, notionalUsd: input.config.perOrderNotionalUsd });
}

export function decideMemecoinLaunchExit(input: MemecoinLaunchExitInput): MemecoinLaunchExitDecision {
  const c = input?.config;
  if (!c || ![input?.nowSec, input?.openedAtSec, input?.costBasisUsd, c.takeProfitPct, c.minHoldSec, c.minProfitAfterHoldPct, c.stopLossPct, c.maxHoldSec].every(finite)
    || input.costBasisUsd <= 0 || input.nowSec < input.openedAtSec || c.takeProfitPct <= 0 || c.minHoldSec < 0 || c.minProfitAfterHoldPct < 0 || c.stopLossPct <= 0 || c.maxHoldSec < c.minHoldSec) return { decision: 'SKIP', reasonCode: 'INVALID_INPUT', reasonMessage: 'Valid position, timing, and exit configuration are required.', pnlPct: null, heldForSec: null };
  const heldForSec = input.nowSec - input.openedAtSec;
  if (!input.sellRouteAvailable) return { decision: 'SKIP', reasonCode: 'SELL_ROUTE_UNAVAILABLE', reasonMessage: 'No executable sell route is available.', pnlPct: null, heldForSec };
  if (!finite(input.executableProceedsUsd) || input.executableProceedsUsd < 0) return { decision: 'HOLD', reasonCode: 'SELL_QUOTE_REQUIRED', reasonMessage: 'An executable sell quote is required.', pnlPct: null, heldForSec };
  const pnlPct = (input.executableProceedsUsd - input.costBasisUsd) / input.costBasisUsd * 100;
  if (input.riskWarning) return { decision: 'EXIT', reasonCode: 'RISK_STOP', reasonMessage: 'Fresh risk evidence requires an exit.', pnlPct, heldForSec };
  const epsilon = 1e-9;
  if (pnlPct + epsilon >= c.takeProfitPct) return { decision: 'EXIT', reasonCode: 'TAKE_PROFIT', reasonMessage: 'Executable net proceeds reached take profit.', pnlPct, heldForSec };
  if (pnlPct - epsilon <= -c.stopLossPct) return { decision: 'EXIT', reasonCode: 'STOP_LOSS', reasonMessage: 'Executable net proceeds crossed stop loss.', pnlPct, heldForSec };
  if (heldForSec >= c.maxHoldSec) return { decision: 'EXIT', reasonCode: 'TIME_STOP', reasonMessage: 'The launch position reached its hard time stop.', pnlPct, heldForSec };
  if (heldForSec >= c.minHoldSec && pnlPct + epsilon >= c.minProfitAfterHoldPct) return { decision: 'EXIT', reasonCode: 'PROFIT_AFTER_MIN_HOLD', reasonMessage: 'The minimum hold elapsed with executable net profit.', pnlPct, heldForSec };
  return { decision: 'HOLD', reasonCode: 'HOLD', reasonMessage: 'No executable exit condition is active.', pnlPct, heldForSec };
}
