import type { MemecoinLaunchScoutVenue } from './manifest';

export type MemecoinLaunchScoutConfig = {
  minPairAgeSec: number; maxPairAgeSec: number; maxObservationAgeSec: number;
  minLiquidityUsd: number; minVolume5mUsd: number; minTxns5m: number;
  minBuys5m: number; minBuySharePct: number; maxPriceChange5mPct: number;
  maxTop10HolderPct: number; maxDevHolderPct: number;
  maxQuoteAgeSec: number; minQuoteValidityRemainingSec: number;
  maxPriceImpactPct: number; maxOrderPoolRatioPct: number;
  perOrderNotionalUsd: number; maxOpenPositions: number;
  maxDailyNotionalUsd: number; maxDailyLossUsd: number;
  takeProfitPct: number; minHoldSec: number; minProfitAfterHoldPct: number;
  stopLossPct: number; maxHoldSec: number;
};

export type MemecoinLaunchScoutProfile = {
  key: 'conservative' | 'balanced' | 'aggressive';
  label: string; description: string; config: Readonly<MemecoinLaunchScoutConfig>;
};

export type MemecoinLaunchObservation = {
  observationId: string; capturedAtSec: number; venue: MemecoinLaunchScoutVenue;
  chainId: 'solana-mainnet'; tokenAddress: string; pairAddress: string | null;
  symbol: string | null; pairCreatedAtSec: number; priceUsd: number;
  priceChange5mPct: number; volume5mUsd: number; txns5m: number;
  buys5m: number; sells5m: number; liquidityUsd: number;
  top10HolderPct: number | null; devHolderPct: number | null;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  dexStatus: 'active' | 'stale' | 'missing'; honeypot: boolean | null;
  buyEnabled: boolean;
};

export type MemecoinLaunchQuote = {
  quoteKey: string; createdAtSec: number; expiresAtSec: number;
  estimatedNotionalUsd: number; priceImpactPct: number | null;
  orderPoolRatioPct: number | null; poolLiquidityUsd: number | null;
  sellability: 'VERIFIED' | 'UNVERIFIED';
};

export type MemecoinLaunchRiskState = {
  openPositionCount: number; dailyExecutedNotionalUsd: number;
  dailyRealizedPnlUsd: number; tokenCooldownUntilSec: number | null;
  globallyEnabled: boolean;
};

export type MemecoinLaunchEntryInput = {
  nowSec: number; observation: MemecoinLaunchObservation;
  quote: MemecoinLaunchQuote | null; risk: MemecoinLaunchRiskState;
  config: MemecoinLaunchScoutConfig;
};

export type MemecoinLaunchEntryReasonCode =
  | 'ENTRY_READY' | 'INVALID_INPUT' | 'STRATEGY_DISABLED' | 'OBSERVATION_STALE'
  | 'PAIR_TOO_NEW' | 'PAIR_TOO_OLD' | 'SECURITY_UNAVAILABLE' | 'SECURITY_REJECTED'
  | 'HOLDER_DATA_UNAVAILABLE' | 'HOLDER_CONCENTRATION_TOO_HIGH' | 'DEV_HOLDING_TOO_HIGH'
  | 'DEX_INACTIVE' | 'BUY_ROUTE_UNAVAILABLE' | 'LIQUIDITY_TOO_LOW' | 'EARLY_ACTIVITY_TOO_LOW'
  | 'BUY_PRESSURE_TOO_LOW' | 'LAUNCH_OVERHEATED' | 'POSITION_LIMIT_REACHED'
  | 'DAILY_NOTIONAL_LIMIT_REACHED' | 'DAILY_LOSS_LIMIT_REACHED' | 'TOKEN_COOLDOWN_ACTIVE'
  | 'QUOTE_REQUIRED' | 'QUOTE_STALE' | 'QUOTE_EXPIRING' | 'QUOTE_METRICS_UNAVAILABLE'
  | 'PRICE_IMPACT_TOO_HIGH' | 'ORDER_POOL_RATIO_TOO_HIGH' | 'SELLABILITY_UNVERIFIED';

export type MemecoinLaunchEntryDecision = {
  decision: 'WAIT' | 'SKIP' | 'ELIGIBLE'; reasonCode: MemecoinLaunchEntryReasonCode;
  reasonMessage: string; decisionKey: string | null; tokenAddress: string | null;
  quoteKey: string | null; notionalUsd: number | null; pairAgeSec: number | null;
  buySharePct: number | null;
};

export type MemecoinLaunchExitInput = {
  nowSec: number; openedAtSec: number; costBasisUsd: number;
  executableProceedsUsd: number | null; riskWarning: boolean;
  sellRouteAvailable: boolean;
  config: Pick<MemecoinLaunchScoutConfig, 'takeProfitPct' | 'minHoldSec' | 'minProfitAfterHoldPct' | 'stopLossPct' | 'maxHoldSec'>;
};

export type MemecoinLaunchExitReasonCode =
  | 'HOLD' | 'TAKE_PROFIT' | 'PROFIT_AFTER_MIN_HOLD' | 'STOP_LOSS' | 'TIME_STOP'
  | 'RISK_STOP' | 'SELL_QUOTE_REQUIRED' | 'SELL_ROUTE_UNAVAILABLE' | 'INVALID_INPUT';

export type MemecoinLaunchExitDecision = {
  decision: 'HOLD' | 'EXIT' | 'SKIP'; reasonCode: MemecoinLaunchExitReasonCode;
  reasonMessage: string; pnlPct: number | null; heldForSec: number | null;
};

export type MemecoinLaunchSimulationScenario = {
  id: string; category: 'ENTRY' | 'DATA_QUALITY' | 'RISK' | 'QUOTE' | 'EXIT';
  description: string; entryInput?: MemecoinLaunchEntryInput;
  exitInput?: MemecoinLaunchExitInput; expected: { decision: string; reasonCode: string };
};

export type MemecoinLaunchSimulationResult = {
  scenarioId: string; category: MemecoinLaunchSimulationScenario['category'];
  decision: MemecoinLaunchEntryDecision | MemecoinLaunchExitDecision;
  passed: boolean; mismatches: string[];
};
