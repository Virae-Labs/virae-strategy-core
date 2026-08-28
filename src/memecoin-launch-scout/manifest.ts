export const MEMECOIN_LAUNCH_SCOUT_VENUES = ['SOLANA'] as const;
export type MemecoinLaunchScoutVenue = typeof MEMECOIN_LAUNCH_SCOUT_VENUES[number];

export const MEMECOIN_LAUNCH_SCOUT_STRATEGY_MANIFEST = {
  id: 'memecoin-launch-scout',
  modelVersion: 'launch-scout-v1',
  inputSchemaVersion: 1,
  executionPolicyVersion: 1,
  executionPhase: 'HOST_EXECUTION_SUPPORTED',
  asset: 'NEW_MEMECOIN_POOLS',
  interval: '5m-signal',
  supportedVenues: MEMECOIN_LAUNCH_SCOUT_VENUES,
} as const;
