import type { HitPriceSnipeStrategyConfig } from './types';

export const DEFAULT_HIT_PRICE_SNIPE_STRATEGY_CONFIG: HitPriceSnipeStrategyConfig = {
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

export function normalizeHitPriceSnipeStrategyConfig(
  input: Partial<HitPriceSnipeStrategyConfig> = {},
): HitPriceSnipeStrategyConfig {
  const config = { ...DEFAULT_HIT_PRICE_SNIPE_STRATEGY_CONFIG, ...input };
  if (!['CONFIRM_HIT', 'PRE_HIT'].includes(config.triggerMode)) throw new Error('Invalid Hit Price Snipe trigger mode.');
  if (!Number.isFinite(config.sizeUsd) || config.sizeUsd <= 0 || config.sizeUsd > 10_000) throw new Error('Invalid Hit Price Snipe size.');
  if (!Number.isFinite(config.preHitBps) || config.preHitBps <= 0 || config.preHitBps > 100) throw new Error('Invalid Hit Price Snipe pre-hit band.');
  if (!Number.isFinite(config.preHitDisableBeforeEndMs) || config.preHitDisableBeforeEndMs < 0) throw new Error('Invalid Hit Price Snipe pre-hit cutoff.');
  if (!Number.isFinite(config.maxBuyPrice) || config.maxBuyPrice <= 0 || config.maxBuyPrice >= 1) throw new Error('Invalid Hit Price Snipe maximum buy price.');
  if (!Number.isFinite(config.minNetEdgeBps) || config.minNetEdgeBps < 0 || config.minNetEdgeBps > 10_000) throw new Error('Invalid Hit Price Snipe minimum edge.');
  if (!Number.isFinite(config.maxSourceLatencyMs) || config.maxSourceLatencyMs < 0) throw new Error('Invalid Hit Price Snipe source latency.');
  if (!Number.isFinite(config.maxTriggerAgeMs) || config.maxTriggerAgeMs < 0) throw new Error('Invalid Hit Price Snipe trigger age.');
  if (!Number.isFinite(config.maxQuoteAgeMs) || config.maxQuoteAgeMs < 0) throw new Error('Invalid Hit Price Snipe quote age.');
  if (!Number.isFinite(config.takerFeeRate) || config.takerFeeRate < 0 || config.takerFeeRate > 1) throw new Error('Invalid Hit Price Snipe taker fee rate.');
  if (!Number.isFinite(config.builderFeeRate) || config.builderFeeRate < 0 || config.builderFeeRate > 1) throw new Error('Invalid Hit Price Snipe builder fee rate.');
  return config;
}
