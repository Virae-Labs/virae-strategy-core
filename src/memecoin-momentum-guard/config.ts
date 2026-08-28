import type { MemecoinMomentumGuardConfig, MemecoinMomentumGuardProfile } from './types';

export const DEFAULT_MEMECOIN_MOMENTUM_GUARD_CONFIG: Readonly<MemecoinMomentumGuardConfig> = {
  minPairAgeSec: 4 * 60 * 60,
  maxObservationAgeSec: 30,
  minLiquidityUsd: 25_000,
  minVolume24hUsd: 25_000,
  minTxns24h: 100,
  minPriceChange1hPct: 3,
  maxPriceChange1hPct: 35,
  minVolumeAnomaly: 1.4,
  minBuySharePct: 50,
  maxBuySharePct: 90,
  maxTop10HolderPct: 40,
  minSignalContinuityCount: 2,
  maxQuoteAgeSec: 10,
  minQuoteValidityRemainingSec: 15,
  maxPriceImpactPct: 3,
  maxOrderPoolRatioPct: 0.5,
  perOrderNotionalUsd: 20,
  maxOpenPositions: 2,
  maxDailyNotionalUsd: 100,
  maxDailyLossUsd: 20,
  takeProfitPct: 20,
  stopLossPct: 8,
  maxHoldSec: 2 * 60 * 60,
};

/** Versioned parameter matrix used by hosts for forward simulation comparisons. */
export const MEMECOIN_MOMENTUM_GUARD_PROFILES: readonly MemecoinMomentumGuardProfile[] = [
  {
    key: 'conservative',
    label: 'Conservative',
    description: 'Higher liquidity and confirmation floors with tighter exits and a shorter hold.',
    config: {
      ...DEFAULT_MEMECOIN_MOMENTUM_GUARD_CONFIG,
      minPairAgeSec: 3 * 60 * 60,
      minLiquidityUsd: 40_000,
      minVolume24hUsd: 40_000,
      minTxns24h: 140,
      minPriceChange1hPct: 5,
      maxPriceChange1hPct: 25,
      minVolumeAnomaly: 1.6,
      minBuySharePct: 52,
      maxBuySharePct: 82,
      maxTop10HolderPct: 35,
      maxPriceImpactPct: 2,
      takeProfitPct: 15,
      stopLossPct: 7,
      maxHoldSec: 90 * 60,
    },
  },
  {
    key: 'balanced',
    label: 'Balanced',
    description: 'A broader forward-simulation baseline balancing confirmation, capacity, and two-hour exits.',
    config: {
      ...DEFAULT_MEMECOIN_MOMENTUM_GUARD_CONFIG,
      minPairAgeSec: 2 * 60 * 60,
      minLiquidityUsd: 20_000,
      minVolume24hUsd: 20_000,
      minTxns24h: 80,
      minVolumeAnomaly: 1.25,
      minBuySharePct: 48,
    },
  },
  {
    key: 'aggressive',
    label: 'Aggressive',
    description: 'Broader momentum capture with lower floors and wider exit bands.',
    config: {
      ...DEFAULT_MEMECOIN_MOMENTUM_GUARD_CONFIG,
      minPairAgeSec: 60 * 60,
      minLiquidityUsd: 15_000,
      minVolume24hUsd: 12_000,
      minTxns24h: 45,
      minPriceChange1hPct: 3,
      maxPriceChange1hPct: 50,
      minVolumeAnomaly: 1.1,
      minBuySharePct: 40,
      maxBuySharePct: 92,
      maxTop10HolderPct: 45,
      maxPriceImpactPct: 4,
      maxOrderPoolRatioPct: 0.75,
      takeProfitPct: 25,
      stopLossPct: 10,
      maxHoldSec: 3 * 60 * 60,
    },
  },
] as const;

export function getMemecoinMomentumGuardProfile(key: string): MemecoinMomentumGuardProfile | null {
  return MEMECOIN_MOMENTUM_GUARD_PROFILES.find((profile) => profile.key === key) ?? null;
}
