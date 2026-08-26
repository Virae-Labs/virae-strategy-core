export type HitPriceSnipeRule = 'HIT_UP_GTE' | 'HIT_DOWN_LTE';
export type HitPriceSnipeTriggerMode = 'CONFIRM_HIT' | 'PRE_HIT';

export type HitPriceSnipeMarketSpec = {
  conditionId: string;
  symbol: string;
  rule: HitPriceSnipeRule;
  strikePrice: number;
  yesTokenId: string;
  priceSource: string;
  startTimeMs: number;
  endTimeMs: number;
};

export type HitPriceSnipeTradeTick = {
  symbol: string;
  priceSource: string;
  previousPrice: number;
  price: number;
  exchangeTimeMs: number;
  receivedTimeMs: number;
};

export type HitPriceSnipeQuote = {
  tokenId: string;
  bestAsk: number | null;
  availableAskNotionalUsd: number;
  receivedTimeMs: number;
  acceptingOrders: boolean;
};

export type HitPriceSnipeStrategyConfig = {
  triggerMode: HitPriceSnipeTriggerMode;
  sizeUsd: number;
  preHitBps: number;
  preHitDisableBeforeEndMs: number;
  maxBuyPrice: number;
  minNetEdgeBps: number;
  maxSourceLatencyMs: number;
  maxTriggerAgeMs: number;
  maxQuoteAgeMs: number;
  takerFeeRate: number;
  builderFeeRate: number;
};

export type HitPriceSnipeDecisionInput = {
  market: HitPriceSnipeMarketSpec;
  tick: HitPriceSnipeTradeTick;
  quote: HitPriceSnipeQuote;
  evaluatedAtMs: number;
  estimatedWinProbability?: number | null;
  config?: Partial<HitPriceSnipeStrategyConfig>;
};

export type HitPriceSnipeReasonCode =
  | 'TRIGGER_CONFIRMED'
  | 'PRE_HIT_ENTERED'
  | 'INVALID_INPUT'
  | 'SOURCE_MISMATCH'
  | 'SYMBOL_MISMATCH'
  | 'MARKET_NOT_OPEN'
  | 'MARKET_ENDED'
  | 'STALE_TRIGGER'
  | 'STALE_QUOTE'
  | 'MARKET_UNAVAILABLE'
  | 'TOKEN_MISMATCH'
  | 'NO_LIQUIDITY'
  | 'NO_CROSSING'
  | 'PRE_HIT_NOT_ENTERED'
  | 'PRE_HIT_DISABLED_NEAR_END'
  | 'PRE_HIT_PROBABILITY_REQUIRED'
  | 'PRICE_ABOVE_LIMIT'
  | 'INSUFFICIENT_EDGE';

export type HitPriceSnipeOrderIntent = {
  intentKey: string;
  triggerMode: HitPriceSnipeTriggerMode;
  side: 'BUY';
  orderType: 'FAK';
  conditionId: string;
  tokenId: string;
  symbol: string;
  rule: HitPriceSnipeRule;
  strikePrice: number;
  triggerPrice: number;
  triggerExchangeTimeMs: number;
  limitPrice: number;
  expectedFillPrice: number;
  requestedNotionalUsd: number;
  requestedSharesAtQuote: number;
  estimatedWinProbability: number;
  estimatedNetEdgeBps: number;
};

export type HitPriceSnipeDecisionResult = {
  decision: 'WAIT' | 'SKIP' | 'ELIGIBLE';
  reasonCode: HitPriceSnipeReasonCode;
  triggerAgeMs: number | null;
  sourceLatencyMs: number | null;
  quoteAgeMs: number | null;
  estimatedNetEdgeBps: number | null;
  intent: HitPriceSnipeOrderIntent | null;
};

export type HitPriceSnipeFillSimulationInput = {
  intent: HitPriceSnipeOrderIntent;
  executionPrice: number | null;
  availableAskNotionalUsd: number;
  resolvedWinning: boolean | null;
  takerFeeRate?: number;
  builderFeeRate?: number;
};

export type HitPriceSnipeFillSimulationResult = {
  status: 'NO_FILL' | 'PARTIAL' | 'FILLED';
  filledNotionalUsd: number;
  filledShares: number;
  unfilledNotionalUsd: number;
  protocolFeeUsd: number;
  builderFeeUsd: number;
  payoutUsd: number | null;
  pnlUsd: number | null;
};

export type HitPriceSnipeSimulationScenario = {
  id: string;
  category: 'TRIGGER' | 'DATA_QUALITY' | 'EXECUTION' | 'ECONOMICS' | 'PRE_HIT';
  description: string;
  input: HitPriceSnipeDecisionInput;
  fill?: Omit<HitPriceSnipeFillSimulationInput, 'intent'>;
  expected: {
    decision: HitPriceSnipeDecisionResult['decision'];
    reasonCode: HitPriceSnipeReasonCode;
    fillStatus?: HitPriceSnipeFillSimulationResult['status'];
    pnlSign?: 'POSITIVE' | 'NEGATIVE' | 'ZERO' | 'PENDING';
  };
};

export type HitPriceSnipeSimulationRowResult = {
  scenarioId: string;
  category: HitPriceSnipeSimulationScenario['category'];
  decision: HitPriceSnipeDecisionResult;
  fill: HitPriceSnipeFillSimulationResult | null;
  passed: boolean;
  mismatches: string[];
};
