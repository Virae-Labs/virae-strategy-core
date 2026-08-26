import {
  BTC15M_VALUE_SNIPE_STRATEGY_MANIFEST,
  DEFAULT_BTC15M_VALUE_SNIPE_CONFIG,
  buildBtc15mValueSnipeSystemSimulationMatrix,
  normalizeBtc15mValueSnipeConfig,
  runBtc15mValueSnipeSystemSimulationMatrix,
} from '..';

describe('BTC 15m Value Snipe', () => {
  it.each(['POLYMARKET', 'PREDICT_FUN'] as const)('passes the built-in %s matrix', (venue) => {
    const matrix = buildBtc15mValueSnipeSystemSimulationMatrix(venue);
    const rows = runBtc15mValueSnipeSystemSimulationMatrix(matrix);
    expect(matrix).toHaveLength(10);
    expect(rows.every((row) => row.passed)).toBe(true);
  });

  it('publishes an explicit host-execution dual-venue manifest', () => {
    expect(BTC15M_VALUE_SNIPE_STRATEGY_MANIFEST).toMatchObject({
      id: 'btc15m-value-snipe',
      executionPhase: 'HOST_EXECUTION_SUPPORTED',
      supportedVenues: ['POLYMARKET', 'PREDICT_FUN'],
    });
  });

  it('normalizes the configurable edge threshold within supported bounds', () => {
    expect(normalizeBtc15mValueSnipeConfig(null)).toEqual(DEFAULT_BTC15M_VALUE_SNIPE_CONFIG);
    expect(normalizeBtc15mValueSnipeConfig({ minEdgeBps: '275' })).toEqual({ minEdgeBps: 275 });
    expect(normalizeBtc15mValueSnipeConfig({ minEdgeBps: -1 })).toEqual({ minEdgeBps: 0 });
    expect(normalizeBtc15mValueSnipeConfig({ minEdgeBps: 5_000 })).toEqual({ minEdgeBps: 2_000 });
  });
});
