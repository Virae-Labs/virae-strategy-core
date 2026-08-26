import {
  buildHitPriceSnipeSystemSimulationMatrix,
  decideHitPriceSnipeEntry,
  runHitPriceSnipeSystemSimulationMatrix,
  simulateHitPriceSnipeFill,
} from '..';

describe('Hit Price Snipe system simulation matrix', () => {
  it('covers trigger, data-quality, execution, economics, and pre-hit boundaries', () => {
    const matrix = buildHitPriceSnipeSystemSimulationMatrix();
    expect(matrix).toHaveLength(20);
    expect(new Set(matrix.map((row) => row.id)).size).toBe(matrix.length);
    expect(new Set(matrix.map((row) => row.category))).toEqual(new Set([
      'TRIGGER', 'DATA_QUALITY', 'EXECUTION', 'ECONOMICS', 'PRE_HIT',
    ]));
    const results = runHitPriceSnipeSystemSimulationMatrix(matrix);
    expect(results.filter((row) => !row.passed)).toEqual([]);
  });

  it('replays deterministically without mutating caller-owned scenarios', () => {
    const matrix = buildHitPriceSnipeSystemSimulationMatrix();
    const before = JSON.parse(JSON.stringify(matrix));
    expect(runHitPriceSnipeSystemSimulationMatrix(matrix)).toEqual(runHitPriceSnipeSystemSimulationMatrix(matrix));
    expect(matrix).toEqual(before);
  });

  it('models the small-win and large-loss asymmetry after protocol fees', () => {
    const eligible = decideHitPriceSnipeEntry(buildHitPriceSnipeSystemSimulationMatrix()[0].input);
    expect(eligible.intent).not.toBeNull();
    const winning = simulateHitPriceSnipeFill({
      intent: eligible.intent!, executionPrice: 0.99, availableAskNotionalUsd: 10, resolvedWinning: true,
    });
    const losing = simulateHitPriceSnipeFill({
      intent: eligible.intent!, executionPrice: 0.99, availableAskNotionalUsd: 10, resolvedWinning: false,
    });
    expect(winning.pnlUsd).toBeGreaterThan(0);
    expect(losing.pnlUsd).toBeLessThan(-9.9);
    expect(Math.abs(losing.pnlUsd!)).toBeGreaterThan(winning.pnlUsd! * 100);
    expect(winning.protocolFeeUsd).toBe(0.007);
  });

  it('rejects invalid fee models instead of returning misleading PnL', () => {
    const eligible = decideHitPriceSnipeEntry(buildHitPriceSnipeSystemSimulationMatrix()[0].input);
    expect(() => simulateHitPriceSnipeFill({
      intent: eligible.intent!,
      executionPrice: 0.99,
      availableAskNotionalUsd: 10,
      resolvedWinning: true,
      takerFeeRate: -0.01,
    })).toThrow('Invalid Hit Price Snipe fill fee rate.');
  });
});
