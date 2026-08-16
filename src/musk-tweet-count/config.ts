import type { MuskTweetStrategyConfig } from './types';
import { readNumber, readOptionalNumber, readRecord } from './utils';

export type MuskTweetSimulationMatrixConfig = MuskTweetStrategyConfig & {
  key: string;
  label: string;
  category: string;
};

export const MUSK_TWEET_SIMULATION_NOTIONAL_USD = 1_000;
export const MUSK_TWEET_MAX_NOTIONAL_USD = 100_000;

export const DEFAULT_MUSK_TWEET_STRATEGY_CONFIG: MuskTweetStrategyConfig = {
  entry: {
    mode: 'LIVE',
    maxNotionalUsd: 1_000,
    minOrderNotionalUsd: 1,
    minExpectedProfitUsd: 0.25,
    entryOrderTtlSeconds: 45,
    takeProfitEnabled: false,
    takeProfitPrice: null,
    tailNoAllocationPct: 0.75,
    lateDirectionalAllocationPct: 0.3,
    lotteryAllocationPct: 0.02,
    lotteryMaxSingleTradePct: 0.05,
    nextMarketPrepositionPct: 0.3,
    lowTailBoundaryBufferTweets: 10,
    lowTailMinAsk: 0.94,
    lowTailMaxAsk: 0.97,
    highTailMinAsk: 0.94,
    highTailMaxAsk: 0.95,
    highTailMaxRemainingHours: 8,
    directionalMinRemainingHours: 2,
    directionalMaxRemainingHours: 4,
    lotteryBurstRate30m: 3,
    lotteryBurstRate60m: 8,
    nextMarketPrepositionMaxHours: 8,
  },
  risk: {
    dailyLossStopUsd: 10,
    maxTaskNetLossUsd: null,
    maxTaskNetProfitUsd: null,
    maxTradesPerDay: 20,
  },
};

const MUSK_TWEET_SIMULATION_BASE_ENTRY = {
  ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry,
  maxNotionalUsd: MUSK_TWEET_SIMULATION_NOTIONAL_USD,
  minExpectedProfitUsd: 50,
  entryOrderTtlSeconds: 45,
};

export const MUSK_TWEET_SIMULATION_MATRIX: MuskTweetSimulationMatrixConfig[] = [
  {
    key: 'baseline',
    label: 'Baseline',
    category: 'control',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'expected-profit-002', label: 'Expected Profit 2% of Basis', category: 'expected-profit',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, minExpectedProfitUsd: 20 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'expected-profit-003', label: 'Expected Profit 3% of Basis', category: 'expected-profit',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, minExpectedProfitUsd: 30 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'tail-allocation-060', label: 'Tail Allocation 60%', category: 'tail-allocation',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, tailNoAllocationPct: 0.6 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'tail-allocation-090', label: 'Tail Allocation 90%', category: 'tail-allocation',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, tailNoAllocationPct: 0.9 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'directional-allocation-020', label: 'Directional Allocation 20%', category: 'directional-allocation',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, lateDirectionalAllocationPct: 0.2 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'directional-allocation-050', label: 'Directional Allocation 50%', category: 'directional-allocation',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, lateDirectionalAllocationPct: 0.5 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'lottery-allocation-001', label: 'Lottery Allocation 1%', category: 'lottery-allocation',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, lotteryAllocationPct: 0.01 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'lottery-allocation-005', label: 'Lottery Allocation 5%', category: 'lottery-allocation',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, lotteryAllocationPct: 0.05 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'next-allocation-015', label: 'Next Market Allocation 15%', category: 'next-market-allocation',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, nextMarketPrepositionPct: 0.15 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'next-allocation-050', label: 'Next Market Allocation 50%', category: 'next-market-allocation',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, nextMarketPrepositionPct: 0.5 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'low-boundary-buffer-015', label: 'Low Tail Boundary Buffer 15', category: 'low-tail-signal',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, lowTailBoundaryBufferTweets: 15 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'low-boundary-buffer-020', label: 'Low Tail Boundary Buffer 20', category: 'low-tail-signal',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, lowTailBoundaryBufferTweets: 20 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'tail-no-ask-090-099', label: 'Tail No Ask 90-99c', category: 'tail-price',
    entry: {
      ...MUSK_TWEET_SIMULATION_BASE_ENTRY,
      lowTailMinAsk: 0.9,
      lowTailMaxAsk: 0.99,
      highTailMinAsk: 0.9,
      highTailMaxAsk: 0.99,
    },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'high-tail-window-012h', label: 'High Tail Window 12h', category: 'high-tail-signal',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, highTailMaxRemainingHours: 12 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'high-tail-window-016h', label: 'High Tail Window 16h', category: 'high-tail-signal',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, highTailMaxRemainingHours: 16 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'directional-window-001-006h', label: 'Directional Window 1-6h', category: 'directional-signal',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, directionalMinRemainingHours: 1, directionalMaxRemainingHours: 6 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'lottery-burst-002-006', label: 'Lottery Burst 2/6', category: 'lottery-signal',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, lotteryBurstRate30m: 2, lotteryBurstRate60m: 6 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'next-window-012h', label: 'Next Market Window 12h', category: 'next-market-signal',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, nextMarketPrepositionMaxHours: 12 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
  {
    key: 'next-window-024h', label: 'Next Market Window 24h', category: 'next-market-signal',
    entry: { ...MUSK_TWEET_SIMULATION_BASE_ENTRY, nextMarketPrepositionMaxHours: 24 },
    risk: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.risk },
  },
];

export function normalizeMuskTweetStrategyConfig(params: {
  entryConfig?: unknown;
  riskConfig?: unknown;
}): MuskTweetStrategyConfig {
  const entry = readRecord(params.entryConfig);
  const risk = readRecord(params.riskConfig);
  const defaults = DEFAULT_MUSK_TWEET_STRATEGY_CONFIG;
  const takeProfitPrice = readOptionalNumber(entry.takeProfitPrice, { min: 0.01, max: 0.999 });

  return {
    entry: {
      ...defaults.entry,
      mode: 'LIVE',
      maxNotionalUsd: readNumber(entry.maxNotionalUsd, defaults.entry.maxNotionalUsd, { min: 1, max: MUSK_TWEET_MAX_NOTIONAL_USD }),
      minOrderNotionalUsd: readNumber(entry.minOrderNotionalUsd, defaults.entry.minOrderNotionalUsd, { min: 1, max: 100 }),
      minExpectedProfitUsd: readNumber(entry.minExpectedProfitUsd, defaults.entry.minExpectedProfitUsd, { min: 0, max: 100 }),
      entryOrderTtlSeconds: Math.trunc(readNumber(entry.entryOrderTtlSeconds, defaults.entry.entryOrderTtlSeconds, { min: 10, max: 300 })),
      takeProfitEnabled: entry.takeProfitEnabled === true && takeProfitPrice != null,
      takeProfitPrice,
      tailNoAllocationPct: readNumber(entry.tailNoAllocationPct, defaults.entry.tailNoAllocationPct, { min: 0, max: 1 }),
      lateDirectionalAllocationPct: readNumber(entry.lateDirectionalAllocationPct, defaults.entry.lateDirectionalAllocationPct, { min: 0, max: 1 }),
      lotteryAllocationPct: readNumber(entry.lotteryAllocationPct, defaults.entry.lotteryAllocationPct, { min: 0, max: 1 }),
      lotteryMaxSingleTradePct: readNumber(entry.lotteryMaxSingleTradePct, defaults.entry.lotteryMaxSingleTradePct, { min: 0, max: 1 }),
      nextMarketPrepositionPct: readNumber(entry.nextMarketPrepositionPct, defaults.entry.nextMarketPrepositionPct, { min: 0, max: 1 }),
      lowTailBoundaryBufferTweets: Math.trunc(readNumber(entry.lowTailBoundaryBufferTweets, defaults.entry.lowTailBoundaryBufferTweets, { min: 1, max: 40 })),
      lowTailMinAsk: readNumber(entry.lowTailMinAsk, defaults.entry.lowTailMinAsk, { min: 0.01, max: 0.99 }),
      lowTailMaxAsk: readNumber(entry.lowTailMaxAsk, defaults.entry.lowTailMaxAsk, { min: 0.01, max: 0.999 }),
      highTailMinAsk: readNumber(entry.highTailMinAsk, defaults.entry.highTailMinAsk, { min: 0.01, max: 0.99 }),
      highTailMaxAsk: readNumber(entry.highTailMaxAsk, defaults.entry.highTailMaxAsk, { min: 0.01, max: 0.999 }),
      highTailMaxRemainingHours: readNumber(entry.highTailMaxRemainingHours, defaults.entry.highTailMaxRemainingHours, { min: 1, max: 48 }),
      directionalMinRemainingHours: readNumber(entry.directionalMinRemainingHours, defaults.entry.directionalMinRemainingHours, { min: 0, max: 24 }),
      directionalMaxRemainingHours: readNumber(entry.directionalMaxRemainingHours, defaults.entry.directionalMaxRemainingHours, { min: 0.5, max: 48 }),
      lotteryBurstRate30m: readNumber(entry.lotteryBurstRate30m, defaults.entry.lotteryBurstRate30m, { min: 0, max: 100 }),
      lotteryBurstRate60m: readNumber(entry.lotteryBurstRate60m, defaults.entry.lotteryBurstRate60m, { min: 0, max: 200 }),
      nextMarketPrepositionMaxHours: readNumber(entry.nextMarketPrepositionMaxHours, defaults.entry.nextMarketPrepositionMaxHours, { min: 1, max: 96 }),
    },
    risk: {
      ...defaults.risk,
      dailyLossStopUsd: readNumber(risk.dailyLossStopUsd, defaults.risk.dailyLossStopUsd, { min: 1, max: 10_000 }),
      maxTaskNetLossUsd: readOptionalNumber(risk.maxTaskNetLossUsd, { min: 1, max: 100_000 }),
      maxTaskNetProfitUsd: readOptionalNumber(risk.maxTaskNetProfitUsd, { min: 1, max: 100_000 }),
      maxTradesPerDay: Math.trunc(readNumber(risk.maxTradesPerDay, defaults.risk.maxTradesPerDay, { min: 1, max: 200 })),
    },
  };
}

export function normalizeMuskTweetSimulationConfig(params: {
  entryConfig?: unknown;
  riskConfig?: unknown;
}): MuskTweetStrategyConfig {
  const normalized = normalizeMuskTweetStrategyConfig(params);
  const entry = readRecord(params.entryConfig);
  return {
    ...normalized,
    entry: {
      ...normalized.entry,
      maxNotionalUsd: readNumber(
        entry.maxNotionalUsd,
        MUSK_TWEET_SIMULATION_NOTIONAL_USD,
        { min: 1, max: 100_000 },
      ),
      minExpectedProfitUsd: readNumber(
        entry.minExpectedProfitUsd,
        50,
        { min: 0, max: 100_000 },
      ),
    },
  };
}
