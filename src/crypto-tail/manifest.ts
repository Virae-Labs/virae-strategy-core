import { TAIL_STRATEGY_MODEL_VERSION } from './types';

/** Stable strategy identity to persist with decisions, orders, and replay fixtures. */
export const CRYPTO_TAIL_STRATEGY_MANIFEST = {
  id: 'crypto-tail-directional',
  modelVersion: TAIL_STRATEGY_MODEL_VERSION,
  inputSchemaVersion: 1,
  executionPolicyVersion: 1,
  supportedAssets: ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'BNB'],
  supportedIntervals: ['15m', '1h'],
} as const;
