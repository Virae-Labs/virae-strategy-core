import type { Btc15mValueSnipeConfig } from './types';

export const DEFAULT_BTC15M_VALUE_SNIPE_CONFIG: Btc15mValueSnipeConfig = {
  minEdgeBps: 150,
};

export function normalizeBtc15mValueSnipeConfig(value: unknown): Btc15mValueSnipeConfig {
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const parsed = Number(input.minEdgeBps);
  return {
    minEdgeBps: Number.isFinite(parsed)
      ? Math.min(2_000, Math.max(0, parsed))
      : DEFAULT_BTC15M_VALUE_SNIPE_CONFIG.minEdgeBps,
  };
}
