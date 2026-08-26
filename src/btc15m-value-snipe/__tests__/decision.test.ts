import {
  BTC15M_VALUE_SNIPE_STRATEGY_MANIFEST,
  buildBtc15mValueSnipeSystemSimulationMatrix,
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
});
