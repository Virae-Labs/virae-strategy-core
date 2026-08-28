import type {
  MemecoinMomentumEntryDecision,
  MemecoinMomentumEntryInput,
  MemecoinMomentumEntryReasonCode,
  MemecoinMomentumExitDecision,
  MemecoinMomentumExitInput,
  MemecoinMomentumSignalType,
} from './types';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function entryResult(
  input: MemecoinMomentumEntryInput | null | undefined,
  decision: MemecoinMomentumEntryDecision['decision'],
  reasonCode: MemecoinMomentumEntryReasonCode,
  reasonMessage: string,
  extras: Partial<MemecoinMomentumEntryDecision> = {},
): MemecoinMomentumEntryDecision {
  const signals = Array.isArray(input?.observation?.signalTypes)
    ? [...new Set(input.observation.signalTypes)]
    : [];
  const buys = input?.observation?.buys1h;
  const sells = input?.observation?.sells1h;
  const buySharePct = finite(buys) && finite(sells) && buys + sells > 0
    ? buys / (buys + sells) * 100
    : null;
  return {
    decision,
    reasonCode,
    reasonMessage,
    decisionKey: null,
    tokenAddress: input?.observation?.tokenAddress ?? null,
    quoteKey: input?.quote?.quoteKey ?? null,
    notionalUsd: null,
    signalTypes: signals,
    buySharePct,
    ...extras,
  };
}

function validConfig(input: MemecoinMomentumEntryInput): boolean {
  const config = input.config;
  const values = Object.values(config);
  return values.every(finite)
    && config.minPairAgeSec >= 0
    && config.maxObservationAgeSec >= 0
    && config.minLiquidityUsd > 0
    && config.minVolume24hUsd >= 0
    && config.minTxns24h >= 0
    && config.maxPriceChange1hPct >= config.minPriceChange1hPct
    && config.maxBuySharePct >= config.minBuySharePct
    && config.maxTop10HolderPct >= 0
    && config.maxTop10HolderPct <= 100
    && config.minSignalContinuityCount >= 1
    && config.maxQuoteAgeSec >= 0
    && config.minQuoteValidityRemainingSec >= 0
    && config.maxPriceImpactPct >= 0
    && config.maxOrderPoolRatioPct > 0
    && config.perOrderNotionalUsd > 0
    && config.maxOpenPositions >= 1
    && config.maxDailyNotionalUsd >= config.perOrderNotionalUsd
    && config.maxDailyLossUsd > 0
    && config.takeProfitPct > 0
    && config.stopLossPct > 0
    && config.maxHoldSec > 0;
}

function hasSignal(signals: MemecoinMomentumSignalType[], signal: MemecoinMomentumSignalType): boolean {
  return signals.includes(signal);
}

/** Pure, deterministic entry evaluation. The host still owns fresh I/O, durable claims and submission. */
export function decideMemecoinMomentumEntry(
  input: MemecoinMomentumEntryInput,
): MemecoinMomentumEntryDecision {
  const observation = input?.observation;
  const risk = input?.risk;
  if (!observation || !risk || !finite(input?.nowSec) || !validConfig(input)
    || observation.venue !== 'SOLANA' || observation.chainId !== 'solana-mainnet'
    || typeof observation.observationId !== 'string' || !observation.observationId
    || typeof observation.tokenAddress !== 'string' || !observation.tokenAddress
    || !Array.isArray(observation.signalTypes)) {
    return entryResult(input, 'SKIP', 'INVALID_INPUT', 'A valid Solana observation, risk state, time, and configuration are required.');
  }
  const numericObservation = [
    observation.capturedAtSec, observation.pairCreatedAtSec, observation.priceUsd,
    observation.priceChange1hPct, observation.volume1hUsd, observation.volume24hUsd,
    observation.volumeAnomaly, observation.txns1h, observation.txns24h,
    observation.buys1h, observation.sells1h, observation.liquidityUsd,
    observation.signalContinuityCount, observation.signalLastSeenAtSec,
    risk.openPositionCount, risk.dailyExecutedNotionalUsd, risk.dailyRealizedPnlUsd,
  ];
  const nonNegativeMetrics = [
    observation.volume1hUsd, observation.volume24hUsd, observation.volumeAnomaly,
    observation.txns1h, observation.txns24h, observation.buys1h, observation.sells1h,
    observation.liquidityUsd, observation.signalContinuityCount,
    risk.openPositionCount, risk.dailyExecutedNotionalUsd,
  ];
  if (!numericObservation.every(finite) || observation.priceUsd <= 0
    || nonNegativeMetrics.some((value) => value < 0)) {
    return entryResult(input, 'SKIP', 'INVALID_INPUT', 'Observation and risk metrics must be finite and non-negative.');
  }
  if (!risk.globallyEnabled) return entryResult(input, 'SKIP', 'STRATEGY_DISABLED', 'The host strategy gate is disabled.');
  if (input.nowSec - observation.capturedAtSec > input.config.maxObservationAgeSec
    || observation.capturedAtSec > input.nowSec + 1) {
    return entryResult(input, 'SKIP', 'OBSERVATION_STALE', 'The market observation is stale or from the future.');
  }
  if (input.nowSec - observation.pairCreatedAtSec < input.config.minPairAgeSec) {
    return entryResult(input, 'SKIP', 'PAIR_TOO_NEW', 'The token pair has not reached the configured minimum age.');
  }
  if (observation.riskLevel === 'UNKNOWN' || observation.honeypot == null) {
    return entryResult(input, 'SKIP', 'SECURITY_UNAVAILABLE', 'Required token security evidence is unavailable.');
  }
  if (observation.riskLevel === 'HIGH' || observation.honeypot
    || hasSignal(observation.signalTypes, 'risk_warning')) {
    return entryResult(input, 'SKIP', 'SECURITY_REJECTED', 'Token security or risk checks rejected entry.');
  }
  if (observation.top10HolderPct == null) {
    return entryResult(input, 'SKIP', 'HOLDER_CONCENTRATION_UNAVAILABLE', 'Top-10 holder concentration is unavailable.');
  }
  if (!finite(observation.top10HolderPct) || observation.top10HolderPct < 0 || observation.top10HolderPct > 100) {
    return entryResult(input, 'SKIP', 'INVALID_INPUT', 'Top-10 holder concentration must be a percentage from 0 to 100.');
  }
  if (observation.top10HolderPct > input.config.maxTop10HolderPct) {
    return entryResult(input, 'SKIP', 'HOLDER_CONCENTRATION_TOO_HIGH', 'Top-10 holder concentration exceeds the configured limit.');
  }
  if (observation.dexStatus !== 'active') return entryResult(input, 'SKIP', 'DEX_INACTIVE', 'Indexed DEX activity is not active.');
  if (!observation.buyEnabled) return entryResult(input, 'SKIP', 'BUY_ROUTE_UNAVAILABLE', 'The host reports no executable buy route.');
  if (observation.liquidityUsd < input.config.minLiquidityUsd) return entryResult(input, 'SKIP', 'LIQUIDITY_TOO_LOW', 'Pool liquidity is below the configured floor.');
  if (observation.volume24hUsd < input.config.minVolume24hUsd || observation.txns24h < input.config.minTxns24h) {
    return entryResult(input, 'SKIP', 'ACTIVITY_TOO_LOW', 'Twenty-four hour volume or transaction activity is below the configured floor.');
  }
  if (observation.priceChange1hPct < input.config.minPriceChange1hPct) return entryResult(input, 'WAIT', 'MOMENTUM_TOO_LOW', 'One-hour price momentum has not reached the configured floor.');
  if (observation.priceChange1hPct > input.config.maxPriceChange1hPct) return entryResult(input, 'SKIP', 'MOMENTUM_OVERHEATED', 'One-hour price momentum is above the configured chase ceiling.');
  const hasMomentum = hasSignal(observation.signalTypes, 'momentum_breakout');
  const hasConfirmation = hasSignal(observation.signalTypes, 'volume_surge')
    || hasSignal(observation.signalTypes, 'buy_pressure');
  if (!hasMomentum || !hasConfirmation || observation.volumeAnomaly < input.config.minVolumeAnomaly) {
    return entryResult(input, 'WAIT', 'SIGNAL_COMBINATION_MISSING', 'Momentum requires volume-surge or buy-pressure confirmation.');
  }
  if (observation.signalContinuityCount < input.config.minSignalContinuityCount
    || input.nowSec - observation.signalLastSeenAtSec > input.config.maxObservationAgeSec
    || observation.signalLastSeenAtSec > input.nowSec + 1) {
    return entryResult(input, 'WAIT', 'SIGNAL_NOT_PERSISTENT', 'The combined signal has not persisted for enough observations.');
  }
  const base = entryResult(input, 'WAIT', 'BUY_SHARE_OUT_OF_RANGE', 'Buy participation is outside the configured range.');
  if (base.buySharePct == null || base.buySharePct < input.config.minBuySharePct
    || base.buySharePct > input.config.maxBuySharePct) return base;
  if (risk.openPositionCount >= input.config.maxOpenPositions) return entryResult(input, 'SKIP', 'POSITION_LIMIT_REACHED', 'The task has reached its open-position limit.');
  if (risk.dailyExecutedNotionalUsd + input.config.perOrderNotionalUsd > input.config.maxDailyNotionalUsd) {
    return entryResult(input, 'SKIP', 'DAILY_NOTIONAL_LIMIT_REACHED', 'This entry would exceed the daily notional limit.');
  }
  if (risk.dailyRealizedPnlUsd <= -input.config.maxDailyLossUsd) return entryResult(input, 'SKIP', 'DAILY_LOSS_LIMIT_REACHED', 'The daily realized loss stop is active.');
  if (risk.tokenCooldownUntilSec != null) {
    if (!finite(risk.tokenCooldownUntilSec)) return entryResult(input, 'SKIP', 'INVALID_INPUT', 'Token cooldown must be finite when present.');
    if (risk.tokenCooldownUntilSec > input.nowSec) return entryResult(input, 'SKIP', 'TOKEN_COOLDOWN_ACTIVE', 'The token is still in its task cooldown window.');
  }
  const quote = input.quote;
  if (!quote) return entryResult(input, 'WAIT', 'QUOTE_REQUIRED', 'An executable quote is required before entry.');
  if (typeof quote.quoteKey !== 'string' || !quote.quoteKey
    || ![quote.createdAtSec, quote.expiresAtSec, quote.estimatedNotionalUsd].every(finite)) {
    return entryResult(input, 'SKIP', 'INVALID_INPUT', 'Executable quote identity, timestamps, and notional are required.');
  }
  if (input.nowSec - quote.createdAtSec > input.config.maxQuoteAgeSec || quote.createdAtSec > input.nowSec + 1) {
    return entryResult(input, 'WAIT', 'QUOTE_STALE', 'The executable quote is stale or from the future.');
  }
  if (quote.expiresAtSec - input.nowSec < input.config.minQuoteValidityRemainingSec) {
    return entryResult(input, 'WAIT', 'QUOTE_EXPIRING', 'The executable quote expires too soon.');
  }
  if (![quote.priceImpactPct, quote.orderPoolRatioPct, quote.poolLiquidityUsd].every(finite)) {
    return entryResult(input, 'SKIP', 'QUOTE_METRICS_UNAVAILABLE', 'Price impact, pool ratio, and quote liquidity must be available.');
  }
  if (quote.priceImpactPct! > input.config.maxPriceImpactPct) return entryResult(input, 'SKIP', 'PRICE_IMPACT_TOO_HIGH', 'Executable price impact exceeds the configured limit.');
  if (quote.orderPoolRatioPct! > input.config.maxOrderPoolRatioPct) return entryResult(input, 'SKIP', 'ORDER_POOL_RATIO_TOO_HIGH', 'Order size is too large relative to pool liquidity.');
  if (quote.poolLiquidityUsd! < input.config.minLiquidityUsd) return entryResult(input, 'SKIP', 'LIQUIDITY_TOO_LOW', 'Quote-time pool liquidity is below the configured floor.');
  if (quote.sellability !== 'VERIFIED') return entryResult(input, 'SKIP', 'SELLABILITY_UNVERIFIED', 'Sellability must be verified before an automated buy.');
  if (Math.abs(quote.estimatedNotionalUsd - input.config.perOrderNotionalUsd) > 0.01) {
    return entryResult(input, 'SKIP', 'INVALID_INPUT', 'Quote notional does not match the configured order notional.');
  }
  return entryResult(input, 'ELIGIBLE', 'ENTRY_READY', 'Persistent momentum, risk, activity, and executable quote gates passed.', {
    decisionKey: `${observation.venue}:${observation.tokenAddress}:${observation.observationId}`,
    quoteKey: quote.quoteKey,
    notionalUsd: input.config.perOrderNotionalUsd,
  });
}

/** Evaluates an already-open position using executable proceeds supplied by the host. */
export function decideMemecoinMomentumExit(input: MemecoinMomentumExitInput): MemecoinMomentumExitDecision {
  const config = input?.config;
  if (!config || ![input?.nowSec, input?.openedAtSec, input?.costBasisUsd,
    config.takeProfitPct, config.stopLossPct, config.maxHoldSec].every(finite)
    || input.costBasisUsd <= 0 || input.nowSec < input.openedAtSec
    || config.takeProfitPct <= 0 || config.stopLossPct <= 0 || config.maxHoldSec <= 0) {
    return { decision: 'SKIP', reasonCode: 'INVALID_INPUT', reasonMessage: 'Valid position, time, and exit configuration are required.', pnlPct: null, heldForSec: null };
  }
  const heldForSec = input.nowSec - input.openedAtSec;
  if (!input.sellRouteAvailable) return { decision: 'SKIP', reasonCode: 'SELL_ROUTE_UNAVAILABLE', reasonMessage: 'No executable sell route is currently available.', pnlPct: null, heldForSec };
  if (!finite(input.executableProceedsUsd) || input.executableProceedsUsd < 0) {
    return { decision: 'HOLD', reasonCode: 'SELL_QUOTE_REQUIRED', reasonMessage: 'An executable sell quote is required to evaluate the position.', pnlPct: null, heldForSec };
  }
  const pnlPct = (input.executableProceedsUsd - input.costBasisUsd) / input.costBasisUsd * 100;
  if (input.riskWarning) return { decision: 'EXIT', reasonCode: 'RISK_STOP', reasonMessage: 'Token risk evidence requires an exit.', pnlPct, heldForSec };
  if (pnlPct >= config.takeProfitPct) return { decision: 'EXIT', reasonCode: 'TAKE_PROFIT', reasonMessage: 'Executable proceeds reached the take-profit threshold.', pnlPct, heldForSec };
  if (pnlPct <= -config.stopLossPct) return { decision: 'EXIT', reasonCode: 'STOP_LOSS', reasonMessage: 'Executable proceeds crossed the stop-loss threshold.', pnlPct, heldForSec };
  if (heldForSec >= config.maxHoldSec) return { decision: 'EXIT', reasonCode: 'TIME_STOP', reasonMessage: 'The position reached its maximum holding time.', pnlPct, heldForSec };
  return { decision: 'HOLD', reasonCode: 'HOLD', reasonMessage: 'No executable exit condition is active.', pnlPct, heldForSec };
}
