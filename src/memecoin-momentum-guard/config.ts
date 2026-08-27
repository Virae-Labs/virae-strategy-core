import type { MemecoinMomentumGuardConfig, MemecoinMomentumGuardProfile } from './types';

export const DEFAULT_MEMECOIN_MOMENTUM_GUARD_CONFIG: Readonly<MemecoinMomentumGuardConfig> = {
  minPairAgeSec: 6 * 60 * 60,
  maxObservationAgeSec: 30,
  minLiquidityUsd: 50_000,
  minVolume24hUsd: 25_000,
  minTxns24h: 100,
  minPriceChange1hPct: 5,
  maxPriceChange1hPct: 35,
  minVolumeAnomaly: 2.5,
  minBuySharePct: 62,
  maxBuySharePct: 85,
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
      minLiquidityUsd: 100_000,
      minVolume24hUsd: 50_000,
      minTxns24h: 180,
      minPriceChange1hPct: 7,
      maxPriceChange1hPct: 25,
      minVolumeAnomaly: 3,
      minBuySharePct: 65,
      maxBuySharePct: 80,
      maxPriceImpactPct: 2,
      takeProfitPct: 15,
      stopLossPct: 7,
      maxHoldSec: 90 * 60,
    },
  },
  {
    key: 'balanced',
    label: 'Balanced',
    description: 'The production baseline balancing confirmation, capacity, and two-hour exits.',
    config: DEFAULT_MEMECOIN_MOMENTUM_GUARD_CONFIG,
  },
  {
    key: 'aggressive',
    label: 'Aggressive',
    description: 'Broader momentum capture with lower floors and wider exit bands.',
    config: {
      ...DEFAULT_MEMECOIN_MOMENTUM_GUARD_CONFIG,
      minPairAgeSec: 2 * 60 * 60,
      minLiquidityUsd: 30_000,
      minVolume24hUsd: 15_000,
      minTxns24h: 60,
      minPriceChange1hPct: 4,
      maxPriceChange1hPct: 45,
      minVolumeAnomaly: 2,
      minBuySharePct: 58,
      maxBuySharePct: 88,
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
