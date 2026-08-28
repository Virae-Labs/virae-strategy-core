import { buildMemecoinLaunchScoutSystemSimulationMatrix, decideMemecoinLaunchEntry, decideMemecoinLaunchExit, getMemecoinLaunchScoutProfile, MEMECOIN_LAUNCH_SCOUT_PROFILES, runMemecoinLaunchScoutSystemSimulationMatrix } from '..';

test('passes every deterministic Launch Scout system matrix row', () => {
  const rows = runMemecoinLaunchScoutSystemSimulationMatrix();
  expect(rows).toHaveLength(21); expect(rows.filter((row) => !row.passed)).toEqual([]);
});

test('exports three stable profiles', () => {
  expect(MEMECOIN_LAUNCH_SCOUT_PROFILES.map((profile) => profile.key)).toEqual(['conservative', 'balanced', 'aggressive']);
  expect(getMemecoinLaunchScoutProfile('balanced')?.config.maxHoldSec).toBe(480);
  expect(getMemecoinLaunchScoutProfile('missing')).toBeNull();
});

test.each([
  ['HOLDER_CONCENTRATION_TOO_HIGH', (i: any) => { i.observation.top10HolderPct = 70; }],
  ['DEV_HOLDING_TOO_HIGH', (i: any) => { i.observation.devHolderPct = 30; }],
  ['LIQUIDITY_TOO_LOW', (i: any) => { i.observation.liquidityUsd = 1_000; }],
  ['DAILY_NOTIONAL_LIMIT_REACHED', (i: any) => { i.risk.dailyExecutedNotionalUsd = 50; }],
  ['ORDER_POOL_RATIO_TOO_HIGH', (i: any) => { i.quote.orderPoolRatioPct = 1; }],
])('fails closed at %s', (reasonCode, mutate) => { const input = buildMemecoinLaunchScoutSystemSimulationMatrix()[0].entryInput!; mutate(input); expect(decideMemecoinLaunchEntry(input).reasonCode).toBe(reasonCode); });

test('requires valid inputs and executable exit evidence', () => {
  expect(decideMemecoinLaunchEntry(null as never)).toMatchObject({ decision: 'SKIP', reasonCode: 'INVALID_INPUT' });
  expect(decideMemecoinLaunchExit({ costBasisUsd: 0 } as never)).toMatchObject({ decision: 'SKIP', reasonCode: 'INVALID_INPUT' });
  const input = buildMemecoinLaunchScoutSystemSimulationMatrix().find((row) => row.id === 'exit-hold')!.exitInput!;
  expect(decideMemecoinLaunchExit({ ...input, sellRouteAvailable: false })).toMatchObject({ decision: 'SKIP', reasonCode: 'SELL_ROUTE_UNAVAILABLE' });
});
