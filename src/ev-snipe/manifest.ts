export const EV_SNIPE_STRATEGY_MANIFEST = {
  id: 'polymarket-crypto-hit-price-snipe',
  modelVersion: 'ev-snipe-simulation-v1',
  inputSchemaVersion: 1,
  executionPolicyVersion: 1,
  executionPhase: 'SIMULATION_ONLY',
  supportedRules: ['HIT_UP_GTE', 'HIT_DOWN_LTE'],
} as const;
