import { TAIL_STRATEGY_MODEL_VERSION } from '../crypto-tail';

export const BTC15M_VALUE_SNIPE_VENUES = ['POLYMARKET', 'PREDICT_FUN'] as const;
export type Btc15mValueSnipeVenue = typeof BTC15M_VALUE_SNIPE_VENUES[number];

export const BTC15M_VALUE_SNIPE_STRATEGY_MANIFEST = {
  id: 'btc15m-value-snipe',
  modelVersion: `${TAIL_STRATEGY_MODEL_VERSION}:value-profile-v1`,
  inputSchemaVersion: 1,
  executionPolicyVersion: 1,
  executionPhase: 'HOST_EXECUTION_SUPPORTED',
  asset: 'BTC',
  interval: '15m',
  supportedVenues: BTC15M_VALUE_SNIPE_VENUES,
} as const;
