import { normalizeEvSnipeStrategyConfig } from './config';
import type {
  EvSnipeDecisionInput,
  EvSnipeDecisionResult,
  EvSnipeMarketSpec,
  EvSnipeReasonCode,
  EvSnipeStrategyConfig,
  EvSnipeTradeTick,
} from './types';

function result(
  decision: EvSnipeDecisionResult['decision'],
  reasonCode: EvSnipeReasonCode,
  triggerAgeMs: number | null,
  quoteAgeMs: number | null,
  estimatedNetEdgeBps: number | null = null,
  sourceLatencyMs: number | null = null,
): EvSnipeDecisionResult {
  return { decision, reasonCode, triggerAgeMs, sourceLatencyMs, quoteAgeMs, estimatedNetEdgeBps, intent: null };
}

function validText(value: string): boolean {
  return Boolean(value?.trim()) && value === value.trim();
}

function validMarket(market: EvSnipeMarketSpec): boolean {
  return validText(market.conditionId)
    && validText(market.symbol)
    && validText(market.yesTokenId)
    && validText(market.priceSource)
    && ['HIT_UP_GTE', 'HIT_DOWN_LTE'].includes(market.rule)
    && Number.isFinite(market.strikePrice)
    && market.strikePrice > 0
    && Number.isFinite(market.startTimeMs)
    && Number.isFinite(market.endTimeMs)
    && market.endTimeMs > market.startTimeMs;
}

function validTick(tick: EvSnipeTradeTick): boolean {
  return validText(tick.symbol)
    && validText(tick.priceSource)
    && Number.isFinite(tick.previousPrice)
    && tick.previousPrice > 0
    && Number.isFinite(tick.price)
    && tick.price > 0
    && Number.isFinite(tick.exchangeTimeMs)
    && Number.isFinite(tick.receivedTimeMs)
    && tick.receivedTimeMs >= tick.exchangeTimeMs;
}

function crossed(market: EvSnipeMarketSpec, tick: EvSnipeTradeTick): boolean {
  return market.rule === 'HIT_UP_GTE'
    ? tick.previousPrice < market.strikePrice && tick.price >= market.strikePrice
    : tick.previousPrice > market.strikePrice && tick.price <= market.strikePrice;
}

function enteredPreHitBand(
  market: EvSnipeMarketSpec,
  tick: EvSnipeTradeTick,
  config: EvSnipeStrategyConfig,
): boolean {
  const band = config.preHitBps / 10_000;
  if (market.rule === 'HIT_UP_GTE') {
    const lower = market.strikePrice * (1 - band);
    return tick.previousPrice < lower && tick.price >= lower && tick.price < market.strikePrice;
  }
  const upper = market.strikePrice * (1 + band);
  return tick.previousPrice > upper && tick.price <= upper && tick.price > market.strikePrice;
}

export function estimateEvSnipeNetEdgeBps(params: {
  winProbability: number;
  price: number;
  takerFeeRate: number;
  builderFeeRate: number;
}): number {
  const protocolFeePerShare = params.takerFeeRate * params.price * (1 - params.price);
  const builderFeePerShare = params.builderFeeRate * params.price;
  return Math.round((params.winProbability - params.price - protocolFeePerShare - builderFeePerShare) * 10_000 * 1e6) / 1e6;
}

export function decideEvSnipeEntry(input: EvSnipeDecisionInput): EvSnipeDecisionResult {
  let config: EvSnipeStrategyConfig;
  try {
    config = normalizeEvSnipeStrategyConfig(input.config);
  } catch {
    return result('SKIP', 'INVALID_INPUT', null, null);
  }

  const { market, tick, quote } = input;
  if (!validMarket(market) || !validTick(tick)
    || !Number.isFinite(input.evaluatedAtMs)
    || !Number.isFinite(quote.receivedTimeMs)
    || !Number.isFinite(quote.availableAskNotionalUsd)
    || quote.availableAskNotionalUsd < 0) {
    return result('SKIP', 'INVALID_INPUT', null, null);
  }

  const triggerAgeMs = input.evaluatedAtMs - tick.receivedTimeMs;
  const sourceLatencyMs = tick.receivedTimeMs - tick.exchangeTimeMs;
  const quoteAgeMs = input.evaluatedAtMs - quote.receivedTimeMs;
  const rejected = (decision: 'WAIT' | 'SKIP', reasonCode: EvSnipeReasonCode, edge: number | null = null) =>
    result(decision, reasonCode, triggerAgeMs, quoteAgeMs, edge, sourceLatencyMs);
  if (triggerAgeMs < 0 || quoteAgeMs < 0) return rejected('SKIP', 'INVALID_INPUT');
  if (market.priceSource !== tick.priceSource) return rejected('SKIP', 'SOURCE_MISMATCH');
  if (market.symbol !== tick.symbol) return rejected('SKIP', 'SYMBOL_MISMATCH');
  if (tick.exchangeTimeMs < market.startTimeMs) return rejected('SKIP', 'MARKET_NOT_OPEN');
  if (tick.exchangeTimeMs > market.endTimeMs) return rejected('SKIP', 'MARKET_ENDED');
  if (sourceLatencyMs > config.maxSourceLatencyMs) return rejected('SKIP', 'STALE_TRIGGER');
  if (triggerAgeMs > config.maxTriggerAgeMs) return rejected('SKIP', 'STALE_TRIGGER');
  if (quoteAgeMs > config.maxQuoteAgeMs) return rejected('SKIP', 'STALE_QUOTE');
  if (!quote.acceptingOrders) return rejected('SKIP', 'MARKET_UNAVAILABLE');
  if (quote.tokenId !== market.yesTokenId) return rejected('SKIP', 'TOKEN_MISMATCH');
  if (quote.bestAsk === null || !Number.isFinite(quote.bestAsk) || quote.bestAsk <= 0 || quote.bestAsk >= 1) {
    return rejected('SKIP', 'INVALID_INPUT');
  }
  if (quote.availableAskNotionalUsd <= 0) return rejected('SKIP', 'NO_LIQUIDITY');

  if (config.triggerMode === 'CONFIRM_HIT') {
    if (!crossed(market, tick)) return rejected('WAIT', 'NO_CROSSING');
  } else {
    if (market.endTimeMs - tick.exchangeTimeMs <= config.preHitDisableBeforeEndMs) {
      return rejected('SKIP', 'PRE_HIT_DISABLED_NEAR_END');
    }
    if (!enteredPreHitBand(market, tick, config)) return rejected('WAIT', 'PRE_HIT_NOT_ENTERED');
    if (!Number.isFinite(input.estimatedWinProbability)
      || (input.estimatedWinProbability as number) <= 0
      || (input.estimatedWinProbability as number) > 1) {
      return rejected('SKIP', 'PRE_HIT_PROBABILITY_REQUIRED');
    }
  }

  if (quote.bestAsk > config.maxBuyPrice) return rejected('SKIP', 'PRICE_ABOVE_LIMIT');
  const winProbability = config.triggerMode === 'CONFIRM_HIT' ? 1 : input.estimatedWinProbability as number;
  const estimatedNetEdgeBps = estimateEvSnipeNetEdgeBps({
    winProbability,
    price: quote.bestAsk,
    takerFeeRate: config.takerFeeRate,
    builderFeeRate: config.builderFeeRate,
  });
  if (estimatedNetEdgeBps < config.minNetEdgeBps) {
    return rejected('SKIP', 'INSUFFICIENT_EDGE', estimatedNetEdgeBps);
  }

  const triggerLeg = config.triggerMode === 'CONFIRM_HIT' ? 'CONFIRM' : 'PRE';
  const intent = {
    intentKey: `${market.conditionId}:${triggerLeg}:${market.rule}`,
    triggerMode: config.triggerMode,
    side: 'BUY' as const,
    orderType: 'FAK' as const,
    conditionId: market.conditionId,
    tokenId: market.yesTokenId,
    symbol: market.symbol,
    rule: market.rule,
    strikePrice: market.strikePrice,
    triggerPrice: tick.price,
    triggerExchangeTimeMs: tick.exchangeTimeMs,
    limitPrice: config.maxBuyPrice,
    expectedFillPrice: quote.bestAsk,
    requestedNotionalUsd: config.sizeUsd,
    requestedSharesAtQuote: Math.floor(config.sizeUsd / quote.bestAsk * 1e6) / 1e6,
    estimatedWinProbability: winProbability,
    estimatedNetEdgeBps,
  };
  return {
    decision: 'ELIGIBLE',
    reasonCode: config.triggerMode === 'CONFIRM_HIT' ? 'TRIGGER_CONFIRMED' : 'PRE_HIT_ENTERED',
    triggerAgeMs,
    sourceLatencyMs,
    quoteAgeMs,
    estimatedNetEdgeBps,
    intent,
  };
}
