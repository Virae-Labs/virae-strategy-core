export type WeatherTemperatureMetric = 'high' | 'low';

export type WeatherTemperatureEntryTiming = 'PRE_DAY' | 'EARLY_DAY';

export type WeatherTemperatureSelectionPolicy = 'TOP1' | 'ADJACENT_TOP2';

export type WeatherTemperatureSignalProfile = 'STRICT' | 'CORE' | 'WIDE';

export type WeatherTemperatureBucket = {
  label: string;
  lowerBound: number | null;
  upperBound: number | null;
};

export type WeatherTemperatureQuote = {
  bestAsk: number | null;
  bestBid: number | null;
  spread: number | null;
  minOrderSize: number | null;
  topAskDepthUsd: number | null;
  fresh: boolean;
  acceptingOrders: boolean;
};

export type WeatherTemperatureCandidate = {
  marketId: string;
  yesTokenId: string;
  bucket: WeatherTemperatureBucket;
  modelProbability: number;
  quote: WeatherTemperatureQuote;
};

export type WeatherTemperatureSnapshot = {
  capturedAt: string;
  forecastRunKey: string;
  eventSlug: string;
  eventTitle: string;
  stationCode: string;
  timezone: string;
  targetDate: string;
  metric: WeatherTemperatureMetric;
  ensembleMemberCount: number;
  ensembleStdDevF: number;
  candidates: WeatherTemperatureCandidate[];
};

export type WeatherTemperatureEntryConfig = {
  stationCodes: string[];
  profile: WeatherTemperatureSignalProfile;
  entryTiming: WeatherTemperatureEntryTiming;
  selectionPolicy: WeatherTemperatureSelectionPolicy;
  eventBudgetUsd: number;
  minModelProbability: number;
  minEdge: number;
  minEntryAsk: number;
  maxEntryAsk: number;
  maxSpread: number;
  maxEnsembleStdDevF: number;
  minTopAskDepthUsd: number;
  maxBucketsPerEvent: 1 | 2;
  preDayStartLocalHour: number;
  highCutoffLocalHour: number;
  lowCutoffLocalHour: number;
  orderTtlSeconds: number;
};

export type WeatherTemperatureRiskConfig = {
  maxOpenExposureUsd: number;
  maxEventsPerDay: number;
  maxTaskNetLossUsd: number | null;
  maxTaskNetProfitUsd: number | null;
};

export type WeatherTemperatureStrategyConfig = {
  entry: WeatherTemperatureEntryConfig;
  risk: WeatherTemperatureRiskConfig;
};

export type WeatherTemperatureIntent = {
  intentKey: string;
  eventSlug: string;
  forecastRunKey: string;
  marketId: string;
  tokenId: string;
  outcomeLabel: string;
  side: 'BUY';
  orderType: 'LIMIT';
  amountKind: 'NOTIONAL';
  amount: number;
  limitPrice: number;
  ttlSeconds: number;
  rank: number;
  modelProbability: number;
  edge: number;
  reason: string;
};

export type WeatherTemperatureCandidateEvaluation = {
  marketId: string;
  tokenId: string;
  decision: 'ENTER' | 'WAIT';
  reasonCode: WeatherTemperatureCandidateReasonCode;
  edge: number | null;
};

export type WeatherTemperatureCandidateReasonCode =
  | 'ENTRY_ELIGIBLE'
  | 'ENTRY_TIMING_MISMATCH'
  | 'FORECAST_DISPERSION_TOO_HIGH'
  | 'MARKET_NOT_ACCEPTING_ORDERS'
  | 'ORDERBOOK_STALE'
  | 'MODEL_PROBABILITY_INVALID'
  | 'PRICE_UNAVAILABLE'
  | 'PRICE_OUT_OF_RANGE'
  | 'BID_OUT_OF_RANGE'
  | 'CROSSED_ORDERBOOK'
  | 'ENTRY_ASK_TOO_LOW'
  | 'ENTRY_ASK_TOO_HIGH'
  | 'SPREAD_INVALID'
  | 'SPREAD_TOO_WIDE'
  | 'TOP_ASK_DEPTH_INVALID'
  | 'TOP_ASK_DEPTH_TOO_LOW'
  | 'MIN_ORDER_SIZE_UNAVAILABLE'
  | 'MIN_ORDER_SIZE_INVALID'
  | 'ORDER_SIZE_BELOW_MARKET_MINIMUM'
  | 'MODEL_PROBABILITY_BELOW_THRESHOLD'
  | 'EDGE_BELOW_THRESHOLD';

export type WeatherTemperatureDiagnosticCode =
  | 'INVALID_NOW'
  | 'SNAPSHOT_IDENTITY_MISSING'
  | 'SNAPSHOT_TIME_INVALID'
  | 'TARGET_DATE_INVALID'
  | 'TIMEZONE_INVALID'
  | 'SNAPSHOT_METRIC_INVALID'
  | 'STATION_NOT_CONFIGURED'
  | 'CANDIDATES_MISSING'
  | 'CANDIDATE_IDENTITY_MISSING'
  | 'CANDIDATE_IDENTITY_DUPLICATED'
  | 'CANDIDATE_BUCKET_INVALID'
  | 'FORECAST_MEMBER_COUNT_INVALID'
  | 'FORECAST_MEMBER_COUNT_TOO_LOW'
  | 'FORECAST_DISPERSION_INVALID'
  | 'EVENT_BUDGET_INVALID'
  | 'CONFIG_INVALID'
  | 'ENTRY_TIMING_MISMATCH'
  | 'ORDER_SIZE_BELOW_MARKET_MINIMUM';

export type WeatherTemperatureDecision = {
  intents: WeatherTemperatureIntent[];
  evaluations: WeatherTemperatureCandidateEvaluation[];
  reasonCode: 'ENTRY_INTENTS' | 'NO_ELIGIBLE_BUCKET' | 'INVALID_INPUT';
  diagnostics: WeatherTemperatureDiagnosticCode[];
};
