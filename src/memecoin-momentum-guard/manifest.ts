export const MEMECOIN_MOMENTUM_GUARD_VENUES = ['SOLANA'] as const;
export type MemecoinMomentumGuardVenue = typeof MEMECOIN_MOMENTUM_GUARD_VENUES[number];

export const MEMECOIN_MOMENTUM_GUARD_STRATEGY_MANIFEST = {
  id: 'memecoin-momentum-guard',
  modelVersion: 'momentum-guard-v2',
  inputSchemaVersion: 1,
  executionPolicyVersion: 1,
  executionPhase: 'HOST_EXECUTION_SUPPORTED',
  asset: 'DYNAMIC_MEMECOIN_UNIVERSE',
  interval: '1h-signal',
  supportedVenues: MEMECOIN_MOMENTUM_GUARD_VENUES,
} as const;
