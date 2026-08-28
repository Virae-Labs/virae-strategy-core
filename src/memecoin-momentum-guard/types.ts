import type { MemecoinMomentumGuardVenue } from './manifest';

export type MemecoinMomentumSignalType =
  | 'momentum_breakout'
  | 'volume_surge'
  | 'buy_pressure'
  | 'risk_warning';

export type MemecoinMomentumGuardConfig = {
  minPairAgeSec: number;
  maxObservationAgeSec: number;
  minLiquidityUsd: number;
  minVolume24hUsd: number;
  minTxns24h: number;
  minPriceChange1hPct: number;
  maxPriceChange1hPct: number;
  minVolumeAnomaly: number;
  minBuySharePct: number;
  maxBuySharePct: number;
  maxTop10HolderPct: number;
  minSignalContinuityCount: number;
  maxQuoteAgeSec: number;
  minQuoteValidityRemainingSec: number;
  maxPriceImpactPct: number;
  maxOrderPoolRatioPct: number;
  perOrderNotionalUsd: number;
  maxOpenPositions: number;
  maxDailyNotionalUsd: number;
  maxDailyLossUsd: number;
  takeProfitPct: number;
  stopLossPct: number;
  maxHoldSec: number;
};

export type MemecoinMomentumGuardProfile = {
  key: 'conservative' | 'balanced' | 'aggressive';
  label: string;
  description: string;
  config: Readonly<MemecoinMomentumGuardConfig>;
};

export type MemecoinMomentumObservation = {
  observationId: string;
  capturedAtSec: number;
  venue: MemecoinMomentumGuardVenue;
  chainId: 'solana-mainnet';
  tokenAddress: string;
  pairAddress: string | null;
  symbol: string | null;
  pairCreatedAtSec: number;
  priceUsd: number;
  priceChange1hPct: number;
  volume1hUsd: number;
  volume24hUsd: number;
  volumeAnomaly: number;
  txns1h: number;
  txns24h: number;
  buys1h: number;
  sells1h: number;
  liquidityUsd: number;
  top10HolderPct: number | null;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  dexStatus: 'active' | 'stale' | 'missing';
  honeypot: boolean | null;
  buyEnabled: boolean;
  signalTypes: MemecoinMomentumSignalType[];
  signalContinuityCount: number;
  signalLastSeenAtSec: number;
};

export type MemecoinExecutableQuote = {
  quoteKey: string;
  createdAtSec: number;
  expiresAtSec: number;
  estimatedNotionalUsd: number;
  priceImpactPct: number | null;
  orderPoolRatioPct: number | null;
  poolLiquidityUsd: number | null;
  sellability: 'VERIFIED' | 'UNVERIFIED';
};

export type MemecoinMomentumRiskState = {
  openPositionCount: number;
  dailyExecutedNotionalUsd: number;
  dailyRealizedPnlUsd: number;
  tokenCooldownUntilSec: number | null;
  globallyEnabled: boolean;
};

export type MemecoinMomentumEntryInput = {
  nowSec: number;
  observation: MemecoinMomentumObservation;
  quote: MemecoinExecutableQuote | null;
  risk: MemecoinMomentumRiskState;
  config: MemecoinMomentumGuardConfig;
};

export type MemecoinMomentumEntryReasonCode =
  | 'ENTRY_READY'
  | 'INVALID_INPUT'
  | 'STRATEGY_DISABLED'
  | 'OBSERVATION_STALE'
  | 'PAIR_TOO_NEW'
  | 'SECURITY_UNAVAILABLE'
  | 'SECURITY_REJECTED'
  | 'HOLDER_CONCENTRATION_UNAVAILABLE'
  | 'HOLDER_CONCENTRATION_TOO_HIGH'
  | 'DEX_INACTIVE'
  | 'BUY_ROUTE_UNAVAILABLE'
  | 'LIQUIDITY_TOO_LOW'
  | 'ACTIVITY_TOO_LOW'
  | 'MOMENTUM_TOO_LOW'
  | 'MOMENTUM_OVERHEATED'
  | 'SIGNAL_COMBINATION_MISSING'
  | 'SIGNAL_NOT_PERSISTENT'
  | 'BUY_SHARE_OUT_OF_RANGE'
  | 'POSITION_LIMIT_REACHED'
  | 'DAILY_NOTIONAL_LIMIT_REACHED'
  | 'DAILY_LOSS_LIMIT_REACHED'
  | 'TOKEN_COOLDOWN_ACTIVE'
  | 'QUOTE_REQUIRED'
  | 'QUOTE_STALE'
  | 'QUOTE_EXPIRING'
  | 'QUOTE_METRICS_UNAVAILABLE'
  | 'PRICE_IMPACT_TOO_HIGH'
  | 'ORDER_POOL_RATIO_TOO_HIGH'
  | 'SELLABILITY_UNVERIFIED';

export type MemecoinMomentumEntryDecision = {
  decision: 'WAIT' | 'SKIP' | 'ELIGIBLE';
  reasonCode: MemecoinMomentumEntryReasonCode;
  reasonMessage: string;
  decisionKey: string | null;
  tokenAddress: string | null;
  quoteKey: string | null;
  notionalUsd: number | null;
  signalTypes: MemecoinMomentumSignalType[];
  buySharePct: number | null;
};

export type MemecoinMomentumExitInput = {
  nowSec: number;
  openedAtSec: number;
  costBasisUsd: number;
  executableProceedsUsd: number | null;
  riskWarning: boolean;
  sellRouteAvailable: boolean;
  config: Pick<MemecoinMomentumGuardConfig, 'takeProfitPct' | 'stopLossPct' | 'maxHoldSec'>;
};

export type MemecoinMomentumExitReasonCode =
  | 'HOLD'
  | 'TAKE_PROFIT'
  | 'STOP_LOSS'
  | 'TIME_STOP'
  | 'RISK_STOP'
  | 'SELL_QUOTE_REQUIRED'
  | 'SELL_ROUTE_UNAVAILABLE'
  | 'INVALID_INPUT';

export type MemecoinMomentumExitDecision = {
  decision: 'HOLD' | 'EXIT' | 'SKIP';
  reasonCode: MemecoinMomentumExitReasonCode;
  reasonMessage: string;
  pnlPct: number | null;
  heldForSec: number | null;
};

export type MemecoinMomentumSimulationScenario = {
  id: string;
  category: 'ENTRY' | 'DATA_QUALITY' | 'RISK' | 'QUOTE' | 'EXIT';
  description: string;
  entryInput?: MemecoinMomentumEntryInput;
  exitInput?: MemecoinMomentumExitInput;
  expected: { decision: string; reasonCode: string };
};

export type MemecoinMomentumSimulationResult = {
  scenarioId: string;
  category: MemecoinMomentumSimulationScenario['category'];
  decision: MemecoinMomentumEntryDecision | MemecoinMomentumExitDecision;
  passed: boolean;
  mismatches: string[];
};
