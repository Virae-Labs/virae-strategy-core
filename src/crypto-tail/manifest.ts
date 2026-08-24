import { TAIL_STRATEGY_MODEL_VERSION } from './types';

export const CRYPTO_TAIL_SUPPORTED_ASSETS = ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'BNB'] as const;
export const CRYPTO_TAIL_SUPPORTED_INTERVALS = ['15m', '1h'] as const;
export const CRYPTO_TAIL_PROFILE_KEYS = CRYPTO_TAIL_SUPPORTED_INTERVALS.flatMap((interval) =>
  CRYPTO_TAIL_SUPPORTED_ASSETS.map((asset) => `${asset.toLowerCase()}-${interval}-tail`),
);

/** Stable strategy identity to persist with decisions, orders, and replay fixtures. */
export const CRYPTO_TAIL_STRATEGY_MANIFEST = {
  id: 'crypto-tail-directional',
  modelVersion: TAIL_STRATEGY_MODEL_VERSION,
  inputSchemaVersion: 2,
  executionPolicyVersion: 2,
  supportedAssets: CRYPTO_TAIL_SUPPORTED_ASSETS,
  supportedIntervals: CRYPTO_TAIL_SUPPORTED_INTERVALS,
} as const;
