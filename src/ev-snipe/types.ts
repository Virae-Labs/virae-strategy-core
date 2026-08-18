export type EvSnipeRule = 'HIT_UP_GTE' | 'HIT_DOWN_LTE';
export type EvSnipeTriggerMode = 'CONFIRM_HIT' | 'PRE_HIT';

export type EvSnipeMarketSpec = {
  conditionId: string;
  symbol: string;
  rule: EvSnipeRule;
  strikePrice: number;
  yesTokenId: string;
  priceSource: string;
  startTimeMs: number;
  endTimeMs: number;
};

export type EvSnipeTradeTick = {
  symbol: string;
  priceSource: string;
  previousPrice: number;
  price: number;
  exchangeTimeMs: number;
  receivedTimeMs: number;
};

export type EvSnipeQuote = {
  tokenId: string;
  bestAsk: number | null;
  availableAskNotionalUsd: number;
  receivedTimeMs: number;
  acceptingOrders: boolean;
};

export type EvSnipeStrategyConfig = {
  triggerMode: EvSnipeTriggerMode;
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

export type EvSnipeDecisionInput = {
  market: EvSnipeMarketSpec;
  tick: EvSnipeTradeTick;
  quote: EvSnipeQuote;
  evaluatedAtMs: number;
  estimatedWinProbability?: number | null;
  config?: Partial<EvSnipeStrategyConfig>;
};

export type EvSnipeReasonCode =
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

export type EvSnipeOrderIntent = {
  intentKey: string;
  triggerMode: EvSnipeTriggerMode;
  side: 'BUY';
  orderType: 'FAK';
  conditionId: string;
  tokenId: string;
  symbol: string;
  rule: EvSnipeRule;
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

export type EvSnipeDecisionResult = {
  decision: 'WAIT' | 'SKIP' | 'ELIGIBLE';
  reasonCode: EvSnipeReasonCode;
  triggerAgeMs: number | null;
  sourceLatencyMs: number | null;
  quoteAgeMs: number | null;
  estimatedNetEdgeBps: number | null;
  intent: EvSnipeOrderIntent | null;
};

export type EvSnipeFillSimulationInput = {
  intent: EvSnipeOrderIntent;
  executionPrice: number | null;
  availableAskNotionalUsd: number;
  resolvedWinning: boolean | null;
  takerFeeRate?: number;
  builderFeeRate?: number;
};

export type EvSnipeFillSimulationResult = {
  status: 'NO_FILL' | 'PARTIAL' | 'FILLED';
  filledNotionalUsd: number;
  filledShares: number;
  unfilledNotionalUsd: number;
  protocolFeeUsd: number;
  builderFeeUsd: number;
  payoutUsd: number | null;
  pnlUsd: number | null;
};

export type EvSnipeSimulationScenario = {
  id: string;
  category: 'TRIGGER' | 'DATA_QUALITY' | 'EXECUTION' | 'ECONOMICS' | 'PRE_HIT';
  description: string;
  input: EvSnipeDecisionInput;
  fill?: Omit<EvSnipeFillSimulationInput, 'intent'>;
  expected: {
    decision: EvSnipeDecisionResult['decision'];
    reasonCode: EvSnipeReasonCode;
    fillStatus?: EvSnipeFillSimulationResult['status'];
    pnlSign?: 'POSITIVE' | 'NEGATIVE' | 'ZERO' | 'PENDING';
  };
};

export type EvSnipeSimulationRowResult = {
  scenarioId: string;
  category: EvSnipeSimulationScenario['category'];
  decision: EvSnipeDecisionResult;
  fill: EvSnipeFillSimulationResult | null;
  passed: boolean;
  mismatches: string[];
};
