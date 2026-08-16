import type { PreMarketLadderMode, PreMarketStrategyConfig } from './types';

export const PRE_MARKET_LADDER_WEIGHTS = [0.23, 0.23, 0.17, 0.14, 0.12, 0.11] as const;
export const PRE_MARKET_NORMAL_PRICES = [0.40, 0.30, 0.24, 0.18, 0.12, 0.06] as const;

export const DEFAULT_PRE_MARKET_STRATEGY_CONFIG: PreMarketStrategyConfig = {
  mode: 'NORMAL',
  sideBudgetUsd: 10,
  launchLeadSeconds: 240,
  launchGraceSeconds: 15,
  cancelAfterOpenSeconds: 20,
  takeProfitDelaySeconds: 300,
  minimumTakeProfitPrice: 0.60,
  takeProfitMultiplier: 2,
};

const roundUpCent = (value: number) => Math.max(0.01, Math.min(0.99, Math.ceil(value * 100 - 1e-9) / 100));

export function preMarketPricesForMode(mode: PreMarketLadderMode): number[] {
  const multiplier = mode === 'SAFE' ? 0.90 : mode === 'AGGRESSIVE' ? 1.10 : 1;
  return PRE_MARKET_NORMAL_PRICES.map((price) => roundUpCent(price * multiplier));
}

export function normalizePreMarketStrategyConfig(
  input: Partial<PreMarketStrategyConfig> = {},
): PreMarketStrategyConfig {
  const config = { ...DEFAULT_PRE_MARKET_STRATEGY_CONFIG, ...input };
  if (!['SAFE', 'NORMAL', 'AGGRESSIVE'].includes(config.mode)) throw new Error('Invalid Pre-M ladder mode.');
  if (!Number.isFinite(config.sideBudgetUsd) || config.sideBudgetUsd < 10 || config.sideBudgetUsd > 100) throw new Error('Pre-M side budget must be between 10 and 100 USD.');
  if (![20, 40].includes(config.cancelAfterOpenSeconds)) throw new Error('Pre-M cancel window must be 20 or 40 seconds.');
  if (!Number.isInteger(config.launchLeadSeconds) || config.launchLeadSeconds < 30 || config.launchLeadSeconds > 600) throw new Error('Invalid Pre-M launch lead.');
  if (!Number.isInteger(config.launchGraceSeconds) || config.launchGraceSeconds < 0 || config.launchGraceSeconds > 60) throw new Error('Invalid Pre-M launch grace.');
  if (!Number.isInteger(config.takeProfitDelaySeconds) || config.takeProfitDelaySeconds < 0 || config.takeProfitDelaySeconds > 900) throw new Error('Invalid Pre-M take-profit delay.');
  if (!Number.isFinite(config.minimumTakeProfitPrice) || !(config.minimumTakeProfitPrice > 0 && config.minimumTakeProfitPrice < 1)) throw new Error('Invalid Pre-M minimum take-profit price.');
  if (!Number.isFinite(config.takeProfitMultiplier) || !(config.takeProfitMultiplier >= 1 && config.takeProfitMultiplier <= 10)) throw new Error('Invalid Pre-M take-profit multiplier.');
  return config;
}
