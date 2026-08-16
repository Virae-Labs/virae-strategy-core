export const BTC_15M_AUTO_TRADE_DEFINITION_ID = 'polymarket-btc-15m-tail-directional';
export const BTC_15M_AUTO_TRADE_CONTROL_KEY = 'btc-15m-tail';
export const TAIL_STRATEGY_MODEL_VERSION = 'heuristic-v2-twap';

export type Btc15mResolutionPriceModel =
  | { kind: 'chainlink-twap'; asset: string; windowSeconds: 30 | 60; configId: string | null }
  | { kind: 'chainlink-spot'; asset: string; windowSeconds: null; configId: string | null }
  | { kind: 'binance'; asset: string; windowSeconds: null; configId: string | null };

export type Btc15mAutoTradeMode = 'LIVE';
export type Btc15mAutoTradeDecision = 'WAIT' | 'SKIP' | 'ELIGIBLE' | 'ORDER_SUBMITTED' | 'ORDER_BLOCKED';
export type Btc15mDailyLossStopBehavior = 'AUTO_RESUME_NEXT_UTC_DAY' | 'REQUIRE_MANUAL_RESUME';

export type Btc15mEntryWindow = {
  secondsToEndMin: number;
  minDistanceBps: number;
};

export type Btc15mEntryConfig = {
  mode: Btc15mAutoTradeMode;
  maxNotionalUsd: number;
  askCap: number;
  minEntryAsk: number;
  edgeGateEnabled: boolean;
  minEdgeBps: number;
  distanceGateEnabled: boolean;
  minDistancePercent: number;
  absoluteDistanceGateEnabled: boolean;
  minAbsoluteDistanceUsd: number;
  directionFlipStopEnabled: boolean;
  distanceCollapseStopEnabled: boolean;
  distanceCollapseStopPercent: number;
  // Consistency gate: skip when recent price momentum opposes the trailing TWAP
  // lead by at least `consistencyMinContradictionBps` (the lead is reversing, so a
  // cheap ask is the market correctly pricing that reversal). Default off.
  consistencyGateEnabled: boolean;
  consistencyMinContradictionBps: number;
  takeProfitEnabled: boolean;
  takeProfitPrice: number | null;
  orderbookStopEnabled: boolean;
  orderbookStopPrice: number | null;
  orderbookStopSlippageBps: number;
  entryWindowStartSeconds: number;
  entryWindowEndSeconds: number;
  entryWindows: Btc15mEntryWindow[];
  maxSpread: number;
  maxSpreadHard: number;
  minLiquidityClob: number;
  depthMultiplier: number;
  entryOrderChaseEnabled: boolean;
  cancelOpenOrdersEnabled: boolean;
  cancelAfterMs: number;
  maxChaseTicks: number;
  // Lifts the initial entry limit by N ticks above best ask so it stays marketable
  // through place->CLOB latency instead of resting passively and being adversely
  // filled. 0 = legacy behavior (place at best ask).
  entryAskOffsetTicks: number;
  hedgeEnabled: boolean;
  hedgeMaxPairCost: number;
};

export type Btc15mRiskConfig = {
  dailyLossStopUsd: number;
  dailyLossStopBehavior: Btc15mDailyLossStopBehavior;
  maxTaskNetLossUsd: number | null;
  maxTaskNetProfitUsd: number | null;
  consecutiveLossStop: number;
  maxTradesPerDay: number;
};

export type Btc15mStrategyConfig = {
  entry: Btc15mEntryConfig;
  risk: Btc15mRiskConfig;
};

export type Btc15mRoundState = {
  roundKey: string;
  eventSlug: string | null;
  eventTitle: string | null;
  eventImage: string | null;
  eventIcon: string | null;
  marketId: string | null;
  marketQuestion: string | null;
  marketImage: string | null;
  marketIcon: string | null;
  upTokenId: string | null;
  downTokenId: string | null;
  upOutcomeLabel: string | null;
  downOutcomeLabel: string | null;
  roundStartSec: number;
  roundEndSec: number;
  priceToBeat: number | null;
  priceToBeatSource: string | null;
  resolutionPriceModel: Btc15mResolutionPriceModel | null;
  active: boolean;
  closed: boolean;
  acceptingOrders: boolean;
  enableOrderBook: boolean;
  orderMinSize: number | null;
  liquidityClob: number | null;
  settlementSourceOk: boolean;
  metadataFresh: boolean;
};

export type Btc15mChainlinkState = {
  startPrice: number | null;
  currentPrice: number | null;
  spotPrice?: number | null;
  spotPointTs?: number | null;
  currentPointTs: number | null;
  fresh: boolean;
  startPriceSource?: string | null;
  priceModel: Btc15mResolutionPriceModel | null;
  startValue?: string | null;
  currentValue?: string | null;
};

export type Btc15mOrderbookState = {
  bestAsk: number | null;
  bestBid: number | null;
  spread: number | null;
  topDepthUsd: number | null;
  // Bid-side top depth, captured alongside `topDepthUsd` (ask) so order-book
  // imbalance can be mined later. Not yet gated on.
  topBidDepthUsd?: number | null;
  tickSize?: number | null;
  askLevels?: Array<{ price: number; size: number }>;
  askLevelCount?: number;
  depthBestAsk?: number | null;
  depthCapturedAtMs?: number | null;
  fresh: boolean;
  source?: 'WSS' | 'REST' | 'WSS_WITH_REST_DEPTH' | 'REST_FALLBACK';
  wssState?: 'connected' | 'connecting' | 'disconnected' | null;
  wssLastMessageAt?: number | null;
};

export type Btc15mRiskState = {
  dailyLossUsd: number;
  taskNetLossUsd: number;
  taskNetPnlUsd?: number;
  taskNetAfterFeePnlUsd?: number;
  openExposureUsd?: number;
  executionDataIncompleteCount?: number;
  consecutiveLosses: number;
  tradesToday: number;
  hasRoundExecution: boolean;
};

export type Btc15mGlobalControl = {
  enabled: boolean;
  liveTradingEnabled: boolean;
  maxNotionalUsd: number | null;
};

export type Btc15mDecisionInput = {
  strategyLabel?: string;
  settlementPairLabel?: string;
  nowSec: number;
  round: Btc15mRoundState | null;
  chainlink: Btc15mChainlinkState;
  orderbook: Btc15mOrderbookState;
  config: Btc15mStrategyConfig;
  risk: Btc15mRiskState;
  global: Btc15mGlobalControl;
};

export type Btc15mDecisionResult = {
  decision: Btc15mAutoTradeDecision;
  reasonCode: string;
  reasonMessage: string;
  candidateOutcome: 'Up' | 'Down' | null;
  selectedTokenId: string | null;
  secondsToEnd: number | null;
  distanceBps: number | null;
  estimatedWinProbability: number | null;
  estimatedAllInCost: number | null;
  edge: number | null;
  notionalUsd: number | null;
  limitPrice: number | null;
};

export type Btc15mGateDiagnosticStatus = 'pass' | 'fail' | 'pending';

export type Btc15mGateDiagnostic = {
  key: string;
  label: string;
  status: Btc15mGateDiagnosticStatus;
  expected: string;
  actual: string;
};

// Public, asset-agnostic aliases. The implementation was originally built for
// BTC 15m rounds, but the same contract is used by BTC/ETH 15m and 1h profiles.
export type CryptoTailResolutionPriceModel = Btc15mResolutionPriceModel;
export type CryptoTailDecision = Btc15mAutoTradeDecision;
export type CryptoTailEntryWindow = Btc15mEntryWindow;
export type CryptoTailEntryConfig = Btc15mEntryConfig;
export type CryptoTailRiskConfig = Btc15mRiskConfig;
export type CryptoTailStrategyConfig = Btc15mStrategyConfig;
export type CryptoTailRoundState = Btc15mRoundState;
export type CryptoTailOracleState = Btc15mChainlinkState;
export type CryptoTailOrderbookState = Btc15mOrderbookState;
export type CryptoTailRiskState = Btc15mRiskState;
export type CryptoTailGlobalControl = Btc15mGlobalControl;
export type CryptoTailDecisionInput = Btc15mDecisionInput;
export type CryptoTailDecisionResult = Btc15mDecisionResult;
export type CryptoTailGateDiagnostic = Btc15mGateDiagnostic;
