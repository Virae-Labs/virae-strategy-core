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
    ...DEFAULT_MEMECOIN_LAUNCH_SCOUT_CONFIG, minPairAgeSec: 120, maxPairAgeSec: 12 * 60,
    minLiquidityUsd: 40_000, minVolume5mUsd: 10_000, minTxns5m: 50, minBuys5m: 35,
    minBuySharePct: 65, maxPriceChange5mPct: 55, maxTop10HolderPct: 35, maxDevHolderPct: 10,
    perOrderNotionalUsd: 8, maxOpenPositions: 2, maxDailyNotionalUsd: 32,
    takeProfitPct: 10, minHoldSec: 4 * 60, stopLossPct: 7, maxHoldSec: 7 * 60,
  } },
  { key: 'balanced', label: 'Balanced', description: 'Small launch entries with executable safety checks and an eight-minute hard exit.', config: DEFAULT_MEMECOIN_LAUNCH_SCOUT_CONFIG },
  { key: 'aggressive', label: 'Aggressive', description: 'Enters younger, thinner launches with a wider payoff and loss envelope.', config: {
    ...DEFAULT_MEMECOIN_LAUNCH_SCOUT_CONFIG, minPairAgeSec: 30, maxPairAgeSec: 20 * 60,
    minLiquidityUsd: 12_000, minVolume5mUsd: 2_500, minTxns5m: 18, minBuys5m: 12,
    minBuySharePct: 55, maxPriceChange5mPct: 120, maxTop10HolderPct: 50, maxDevHolderPct: 20,
    maxPriceImpactPct: 4, maxOrderPoolRatioPct: 0.4, perOrderNotionalUsd: 12,
    maxOpenPositions: 4, maxDailyNotionalUsd: 72, takeProfitPct: 18,
    minHoldSec: 2 * 60, minProfitAfterHoldPct: 1, stopLossPct: 10, maxHoldSec: 10 * 60,
  } },
] as const;

export function getMemecoinLaunchScoutProfile(key: string): MemecoinLaunchScoutProfile | null {
  return MEMECOIN_LAUNCH_SCOUT_PROFILES.find((profile) => profile.key === key) ?? null;
}
