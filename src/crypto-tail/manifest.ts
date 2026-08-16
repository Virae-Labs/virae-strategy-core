import { TAIL_STRATEGY_MODEL_VERSION } from './types';

export const CRYPTO_TAIL_STRATEGY_MANIFEST = {
  id: 'crypto-tail-directional',
  modelVersion: TAIL_STRATEGY_MODEL_VERSION,
  inputSchemaVersion: 1,
  executionPolicyVersion: 1,
  supportedAssets: ['BTC', 'ETH'],
  supportedIntervals: ['15m', '1h'],
} as const;
