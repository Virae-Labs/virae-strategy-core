export type MuskTweetStrategyId =
  | 'TAIL_NO_LOW'
  | 'TAIL_NO_HIGH'
  | 'DIRECTIONAL_LATE'
  | 'LOTTERY_YES'
  | 'NEXT_MARKET_PREPOSITION';

export type MuskTweetMarketRange = {
  marketId?: string | null;
  label: string;
  minInclusive: number;
  maxInclusive: number | null;
  yesTokenId: string;
  noTokenId: string;
  yesPrice?: number | null;
  noPrice?: number | null;
  imageUrl?: string | null;
};

export type MuskTweetMarket = {
  eventSlug: string;
  title: string;
  startAt: string;
  endAt: string;
  status: 'active' | 'upcoming';
  sourceUrl?: string | null;
  imageUrl?: string | null;
  ranges: MuskTweetMarketRange[];
};

export type MuskTweetDiscoverySnapshot = {
  capturedAt: string;
  selected: MuskTweetMarket | null;
  selectedMarkets: MuskTweetMarket[];
  candidates: MuskTweetMarket[];
  diagnostics: string[];
};

export type MuskTweetCounterSnapshot = {
  count: number;
  source: 'xtracker' | 'manual';
  fresh: boolean;
  updatedAt: string;
  latestPostAt?: string | null;
  postsFetched?: number;
  lastSyncAgeSeconds?: number | null;
  recentPosts?: Array<{ id: string; platformId: string; createdAt: string; importedAt?: string; content: string }>;
};

export type MuskTweetRateSnapshot = {
  rate30m: number;
  rate60m: number;
  rate2h: number;
  rate6h: number;
  rate24h: number;
  cooldownHours: number;
  eventFactor: 'normal' | 'cooldown' | 'burst' | 'special_event';
};

export type MuskTweetOrderbookQuote = {
  tokenId: string;
  minOrderSize: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  topDepthUsd: number | null;
  fresh: boolean;
  source: 'REST' | 'UNAVAILABLE';
};

export type MuskTweetSnapshot = {
  id: string;
  capturedAt: string;
  market: MuskTweetMarket;
  counter: MuskTweetCounterSnapshot;
  rates: MuskTweetRateSnapshot;
  remainingHours: number;
  orderbooks: MuskTweetOrderbookQuote[];
  diagnostics: string[];
};

export type MuskTweetTradeIntent = {
  id: string;
  intentKey: string;
  strategy: MuskTweetStrategyId;
  tokenId: string;
  label: string;
  side: 'BUY' | 'SELL';
  limitPrice: number;
  amountKind: 'NOTIONAL' | 'SHARES';
  amount: number;
  reason: string;
  status: 'generated' | 'rejected';
  ttlSeconds: number;
  rejectionReason?: string;
  createdAt: string;
};

export type MuskTweetStrategyCheck = {
  strategy: MuskTweetStrategyId;
  status: 'eligible' | 'blocked' | 'not-applicable';
  target?: string | null;
  reason: string;
  blockers: string[];
  amountUsd?: number | null;
  limitPrice?: number | null;
};

export type MuskTweetEvaluation = {
  intents: MuskTweetTradeIntent[];
  rejected: MuskTweetTradeIntent[];
  checks: MuskTweetStrategyCheck[];
  diagnostics: string[];
  inputErrorCode?: MuskTweetInputErrorCode;
};

export type MuskTweetInputErrorCode =
  | 'INVALID_NOW_SEC'
  | 'INVALID_SNAPSHOT_CAPTURED_AT'
  | 'INVALID_MARKET_START_AT'
  | 'INVALID_MARKET_END_AT'
  | 'INVALID_COUNTER_UPDATED_AT'
  | 'INVALID_COUNTER_COUNT'
  | 'INVALID_REMAINING_HOURS'
  | 'INVALID_RATE_SNAPSHOT'
  | 'INVALID_MARKET_RANGES'
  | 'INVALID_ORDERBOOKS'
  | 'INVALID_ENTRY_CONFIG';

export type MuskTweetEntryConfig = {
  mode: 'LIVE';
  maxNotionalUsd: number;
  minOrderNotionalUsd: number;
  minExpectedProfitUsd: number;
  entryOrderTtlSeconds: number;
  takeProfitEnabled: boolean;
  takeProfitPrice: number | null;
  tailNoAllocationPct: number;
  lateDirectionalAllocationPct: number;
  lotteryAllocationPct: number;
  lotteryMaxSingleTradePct: number;
  nextMarketPrepositionPct: number;
  lowTailBoundaryBufferTweets: number;
  lowTailMinAsk: number;
  lowTailMaxAsk: number;
  highTailMinAsk: number;
  highTailMaxAsk: number;
  highTailMaxRemainingHours: number;
  directionalMinRemainingHours: number;
  directionalMaxRemainingHours: number;
  lotteryBurstRate30m: number;
  lotteryBurstRate60m: number;
  nextMarketPrepositionMaxHours: number;
};

export type MuskTweetRiskConfig = {
  dailyLossStopUsd: number;
  maxTaskNetLossUsd: number | null;
  maxTaskNetProfitUsd: number | null;
  maxTradesPerDay: number;
};

export type MuskTweetRiskState = {
  dailyLossUsd: number;
  taskNetLossUsd: number;
  taskNetPnlUsd?: number;
  taskNetAfterFeePnlUsd?: number;
  openExposureUsd?: number;
  executionDataIncompleteCount?: number;
  tradesToday: number;
};

export type MuskTweetStrategyConfig = {
  entry: MuskTweetEntryConfig;
  risk: MuskTweetRiskConfig;
};
