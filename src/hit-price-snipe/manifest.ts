export const HIT_PRICE_SNIPE_STRATEGY_MANIFEST = {
  id: 'polymarket-crypto-hit-price-snipe',
  modelVersion: 'hit-price-snipe-simulation-v1',
  inputSchemaVersion: 1,
  executionPolicyVersion: 1,
  executionPhase: 'HOST_EXECUTION_SUPPORTED',
  supportedRules: ['HIT_UP_GTE', 'HIT_DOWN_LTE'],
} as const;
