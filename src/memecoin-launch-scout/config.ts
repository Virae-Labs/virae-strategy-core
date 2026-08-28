import type { MemecoinLaunchScoutConfig, MemecoinLaunchScoutProfile } from './types';

export const DEFAULT_MEMECOIN_LAUNCH_SCOUT_CONFIG: Readonly<MemecoinLaunchScoutConfig> = {
  minPairAgeSec: 60, maxPairAgeSec: 15 * 60, maxObservationAgeSec: 20,
  minLiquidityUsd: 20_000, minVolume5mUsd: 5_000, minTxns5m: 30,
  minBuys5m: 20, minBuySharePct: 60, maxPriceChange5mPct: 80,
  maxTop10HolderPct: 45, maxDevHolderPct: 15,
  maxQuoteAgeSec: 8, minQuoteValidityRemainingSec: 15,
  maxPriceImpactPct: 3, maxOrderPoolRatioPct: 0.25,
  perOrderNotionalUsd: 10, maxOpenPositions: 3,
  maxDailyNotionalUsd: 50, maxDailyLossUsd: 15,
  takeProfitPct: 12, minHoldSec: 3 * 60, minProfitAfterHoldPct: 2,
  stopLossPct: 8, maxHoldSec: 8 * 60,
};

export const MEMECOIN_LAUNCH_SCOUT_PROFILES: readonly MemecoinLaunchScoutProfile[] = [
  { key: 'conservative', label: 'Conservative', description: 'Waits longer for deeper liquidity and stronger early participation.', config: {
    ...DEFAULT_MEMECOIN_LAUNCH_SCOUT_CONFIG, minPairAgeSec: 120, maxPairAgeSec: 30 * 60,
    minLiquidityUsd: 32_000, minVolume5mUsd: 8_000, minTxns5m: 40, minBuys5m: 28,
    minBuySharePct: 62, maxPriceChange5mPct: 55, maxTop10HolderPct: 35, maxDevHolderPct: 10,
    perOrderNotionalUsd: 8, maxOpenPositions: 2, maxDailyNotionalUsd: 32,
    takeProfitPct: 10, minHoldSec: 4 * 60, stopLossPct: 7, maxHoldSec: 7 * 60,
  } },
  { key: 'balanced', label: 'Balanced', description: 'A wider forward-simulation launch window with executable safety checks and an eight-minute hard exit.', config: {
    ...DEFAULT_MEMECOIN_LAUNCH_SCOUT_CONFIG,
    maxPairAgeSec: 45 * 60,
    minLiquidityUsd: 16_000,
    minVolume5mUsd: 4_000,
    minTxns5m: 24,
    minBuys5m: 16,
    minBuySharePct: 58,
  } },
  { key: 'aggressive', label: 'Aggressive', description: 'Enters younger, thinner launches with a wider payoff and loss envelope.', config: {
    ...DEFAULT_MEMECOIN_LAUNCH_SCOUT_CONFIG, minPairAgeSec: 30, maxPairAgeSec: 60 * 60,
    minLiquidityUsd: 10_000, minVolume5mUsd: 2_000, minTxns5m: 14, minBuys5m: 10,
    minBuySharePct: 52, maxPriceChange5mPct: 120, maxTop10HolderPct: 50, maxDevHolderPct: 20,
    maxPriceImpactPct: 4, maxOrderPoolRatioPct: 0.4, perOrderNotionalUsd: 12,
    maxOpenPositions: 4, maxDailyNotionalUsd: 72, takeProfitPct: 18,
    minHoldSec: 2 * 60, minProfitAfterHoldPct: 1, stopLossPct: 10, maxHoldSec: 10 * 60,
  } },
] as const;

export function getMemecoinLaunchScoutProfile(key: string): MemecoinLaunchScoutProfile | null {
  return MEMECOIN_LAUNCH_SCOUT_PROFILES.find((profile) => profile.key === key) ?? null;
}
