import type { EvSnipeStrategyConfig } from './types';

export const DEFAULT_EV_SNIPE_STRATEGY_CONFIG: EvSnipeStrategyConfig = {
  triggerMode: 'CONFIRM_HIT',
  sizeUsd: 10,
  preHitBps: 1,
  preHitDisableBeforeEndMs: 4 * 60 * 60 * 1_000,
  maxBuyPrice: 0.99,
  minNetEdgeBps: 25,
  maxSourceLatencyMs: 1_200,
  maxTriggerAgeMs: 250,
  maxQuoteAgeMs: 1_000,
  takerFeeRate: 0.07,
  builderFeeRate: 0,
};

export function normalizeEvSnipeStrategyConfig(
  input: Partial<EvSnipeStrategyConfig> = {},
): EvSnipeStrategyConfig {
  const config = { ...DEFAULT_EV_SNIPE_STRATEGY_CONFIG, ...input };
  if (!['CONFIRM_HIT', 'PRE_HIT'].includes(config.triggerMode)) throw new Error('Invalid EV Snipe trigger mode.');
  if (!Number.isFinite(config.sizeUsd) || config.sizeUsd <= 0 || config.sizeUsd > 10_000) throw new Error('Invalid EV Snipe size.');
  if (!Number.isFinite(config.preHitBps) || config.preHitBps <= 0 || config.preHitBps > 100) throw new Error('Invalid EV Snipe pre-hit band.');
  if (!Number.isFinite(config.preHitDisableBeforeEndMs) || config.preHitDisableBeforeEndMs < 0) throw new Error('Invalid EV Snipe pre-hit cutoff.');
  if (!Number.isFinite(config.maxBuyPrice) || config.maxBuyPrice <= 0 || config.maxBuyPrice >= 1) throw new Error('Invalid EV Snipe maximum buy price.');
  if (!Number.isFinite(config.minNetEdgeBps) || config.minNetEdgeBps < 0 || config.minNetEdgeBps > 10_000) throw new Error('Invalid EV Snipe minimum edge.');
  if (!Number.isFinite(config.maxSourceLatencyMs) || config.maxSourceLatencyMs < 0) throw new Error('Invalid EV Snipe source latency.');
  if (!Number.isFinite(config.maxTriggerAgeMs) || config.maxTriggerAgeMs < 0) throw new Error('Invalid EV Snipe trigger age.');
  if (!Number.isFinite(config.maxQuoteAgeMs) || config.maxQuoteAgeMs < 0) throw new Error('Invalid EV Snipe quote age.');
  if (!Number.isFinite(config.takerFeeRate) || config.takerFeeRate < 0 || config.takerFeeRate > 1) throw new Error('Invalid EV Snipe taker fee rate.');
  if (!Number.isFinite(config.builderFeeRate) || config.builderFeeRate < 0 || config.builderFeeRate > 1) throw new Error('Invalid EV Snipe builder fee rate.');
  return config;
}
