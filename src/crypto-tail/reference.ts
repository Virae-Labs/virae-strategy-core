import type { CryptoTailStrategyConfig } from './types';

/**
 * Runnable reference preset for paper trading and replay examples.
 *
 * This is not a promise that Virae production uses these effective values and
 * is not a recommendation to trade real funds.
 */
export const REFERENCE_CRYPTO_TAIL_CONFIG_V1: CryptoTailStrategyConfig = {
  entry: {
    mode: 'LIVE',
    maxNotionalUsd: 5,
    askCap: 0.95,
    minEntryAsk: 0.9,
    edgeGateEnabled: true,
    minEdgeBps: 150,
    distanceGateEnabled: false,
    minDistancePercent: 0.1,
    absoluteDistanceGateEnabled: false,
    minAbsoluteDistanceUsd: 30,
    directionFlipStopEnabled: false,
    distanceCollapseStopEnabled: false,
    distanceCollapseStopPercent: 40,
    consistencyGateEnabled: false,
    consistencyMinContradictionBps: 1.5,
    takeProfitEnabled: false,
    takeProfitPrice: null,
    orderbookStopEnabled: false,
    orderbookStopPrice: null,
    orderbookStopSlippageBps: 300,
    entryWindowStartSeconds: 120,
    entryWindowEndSeconds: 4,
    entryWindows: [
      { secondsToEndMin: 90, minDistanceBps: 0 },
      { secondsToEndMin: 60, minDistanceBps: 0 },
      { secondsToEndMin: 30, minDistanceBps: 0 },
      { secondsToEndMin: 20, minDistanceBps: 0 },
      { secondsToEndMin: 16, minDistanceBps: 0 },
      { secondsToEndMin: 4, minDistanceBps: 0 },
    ],
    maxSpread: 0.01,
    maxSpreadHard: 0.02,
    minLiquidityClob: 1_000,
    depthMultiplier: 3,
    entryOrderChaseEnabled: true,
    cancelOpenOrdersEnabled: false,
    cancelAfterMs: 10_000,
    maxChaseTicks: 1,
    entryAskOffsetTicks: 0,
    hedgeEnabled: false,
    hedgeMaxPairCost: 0.985,
  },
  risk: {
    dailyLossStopUsd: 10,
    dailyLossStopBehavior: 'AUTO_RESUME_NEXT_UTC_DAY',
    maxTaskNetLossUsd: null,
    maxTaskNetProfitUsd: null,
    consecutiveLossStop: 3,
    maxTradesPerDay: 20,
  },
};
