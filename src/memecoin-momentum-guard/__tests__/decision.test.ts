import {
  buildMemecoinMomentumGuardSimulationMatrix,
  decideMemecoinMomentumEntry,
  decideMemecoinMomentumExit,
  runMemecoinMomentumGuardSimulationMatrix,
  MEMECOIN_MOMENTUM_GUARD_PROFILES,
  getMemecoinMomentumGuardProfile,
} from '..';

test('passes every deterministic Momentum Guard simulation row', () => {
  const results = runMemecoinMomentumGuardSimulationMatrix();
  expect(results).toHaveLength(15);
  expect(results.filter((row) => !row.passed)).toEqual([]);
});

test('exports a stable three-profile forward simulation matrix', () => {
  expect(MEMECOIN_MOMENTUM_GUARD_PROFILES.map((profile) => profile.key)).toEqual([
    'conservative', 'balanced', 'aggressive',
  ]);
  expect(getMemecoinMomentumGuardProfile('balanced')?.config.perOrderNotionalUsd).toBe(20);
  expect(getMemecoinMomentumGuardProfile('missing')).toBeNull();
});

test('exports calibrated forward-simulation thresholds', () => {
  expect(getMemecoinMomentumGuardProfile('conservative')?.config).toMatchObject({
    minPairAgeSec: 3 * 60 * 60,
    minLiquidityUsd: 40_000,
    minPriceChange1hPct: 5,
    maxPriceChange1hPct: 25,
    minVolumeAnomaly: 1.6,
    minBuySharePct: 52,
    maxBuySharePct: 82,
    maxTop10HolderPct: 35,
  });
  expect(getMemecoinMomentumGuardProfile('balanced')?.config).toMatchObject({
    minPairAgeSec: 2 * 60 * 60,
    minLiquidityUsd: 20_000,
    minPriceChange1hPct: 3,
    maxPriceChange1hPct: 35,
    minVolumeAnomaly: 1.25,
    minBuySharePct: 48,
    maxBuySharePct: 90,
    maxTop10HolderPct: 40,
  });
  expect(getMemecoinMomentumGuardProfile('aggressive')?.config).toMatchObject({
    minPairAgeSec: 60 * 60,
    minLiquidityUsd: 15_000,
    minPriceChange1hPct: 3,
    maxPriceChange1hPct: 50,
    minVolumeAnomaly: 1.1,
    minBuySharePct: 40,
    maxBuySharePct: 92,
    maxTop10HolderPct: 45,
  });
});

test.each([
  ['STRATEGY_DISABLED', (input: any) => { input.risk.globallyEnabled = false; }],
  ['PAIR_TOO_NEW', (input: any) => { input.observation.pairCreatedAtSec = input.nowSec - 60; }],
  ['SECURITY_REJECTED', (input: any) => { input.observation.riskLevel = 'HIGH'; }],
  ['HOLDER_CONCENTRATION_UNAVAILABLE', (input: any) => { input.observation.top10HolderPct = null; }],
  ['HOLDER_CONCENTRATION_TOO_HIGH', (input: any) => { input.observation.top10HolderPct = 60; }],
  ['DEX_INACTIVE', (input: any) => { input.observation.dexStatus = 'stale'; }],
  ['BUY_ROUTE_UNAVAILABLE', (input: any) => { input.observation.buyEnabled = false; }],
  ['LIQUIDITY_TOO_LOW', (input: any) => { input.observation.liquidityUsd = 1_000; }],
  ['ACTIVITY_TOO_LOW', (input: any) => { input.observation.volume24hUsd = 1_000; }],
  ['MOMENTUM_TOO_LOW', (input: any) => { input.observation.priceChange1hPct = 1; }],
  ['SIGNAL_COMBINATION_MISSING', (input: any) => { input.observation.signalTypes = ['momentum_breakout']; }],
  ['SIGNAL_NOT_PERSISTENT', (input: any) => { input.observation.signalLastSeenAtSec = input.nowSec + 10; }],
  ['BUY_SHARE_OUT_OF_RANGE', (input: any) => { input.observation.buys1h = 40; input.observation.sells1h = 60; }],
  ['DAILY_NOTIONAL_LIMIT_REACHED', (input: any) => { input.risk.dailyExecutedNotionalUsd = 90; }],
  ['TOKEN_COOLDOWN_ACTIVE', (input: any) => { input.risk.tokenCooldownUntilSec = input.nowSec + 60; }],
  ['QUOTE_STALE', (input: any) => { input.quote.createdAtSec = input.nowSec - 20; }],
  ['ORDER_POOL_RATIO_TOO_HIGH', (input: any) => { input.quote.orderPoolRatioPct = 1; }],
  ['SELLABILITY_UNVERIFIED', (input: any) => { input.quote.sellability = 'UNVERIFIED'; }],
  ['INVALID_INPUT', (input: any) => { input.quote.estimatedNotionalUsd = 19; }],
])('fails or waits with %s at its dedicated entry gate', (reasonCode, mutate) => {
  const input = buildMemecoinMomentumGuardSimulationMatrix()[0].entryInput!;
  mutate(input);
  expect(decideMemecoinMomentumEntry(input).reasonCode).toBe(reasonCode);
});

test('fails closed for malformed entry and exit inputs', () => {
  expect(decideMemecoinMomentumEntry(null as never)).toMatchObject({ decision: 'SKIP', reasonCode: 'INVALID_INPUT' });
  expect(decideMemecoinMomentumExit({ costBasisUsd: 0 } as never)).toMatchObject({ decision: 'SKIP', reasonCode: 'INVALID_INPUT' });
});

test('requires an executable sell route and quote before exit evaluation', () => {
  const base = buildMemecoinMomentumGuardSimulationMatrix().find((row) => row.id === 'exit-hold')!.exitInput!;
  expect(decideMemecoinMomentumExit({ ...base, sellRouteAvailable: false })).toMatchObject({
    decision: 'SKIP', reasonCode: 'SELL_ROUTE_UNAVAILABLE',
  });
  expect(decideMemecoinMomentumExit({ ...base, executableProceedsUsd: null })).toMatchObject({
    decision: 'HOLD', reasonCode: 'SELL_QUOTE_REQUIRED',
  });
});

test('returns a stable decision key without mutating the input', () => {
  const input = buildMemecoinMomentumGuardSimulationMatrix()[0].entryInput!;
  const before = structuredClone(input);
  expect(decideMemecoinMomentumEntry(input)).toMatchObject({
    decision: 'ELIGIBLE',
    decisionKey: `SOLANA:${input.observation.tokenAddress}:${input.observation.observationId}`,
    quoteKey: 'quote-1',
    notionalUsd: 20,
  });
  expect(input).toEqual(before);
});

test('fails closed for non-finite quote metrics', () => {
  const input = buildMemecoinMomentumGuardSimulationMatrix()[0].entryInput!;
  input.quote!.priceImpactPct = Number.NaN;
  expect(decideMemecoinMomentumEntry(input)).toMatchObject({
    decision: 'SKIP',
    reasonCode: 'QUOTE_METRICS_UNAVAILABLE',
  });
});

test('rejects invalid exit thresholds in the entry configuration', () => {
  const input = buildMemecoinMomentumGuardSimulationMatrix()[0].entryInput!;
  input.config.takeProfitPct = 0;
  expect(decideMemecoinMomentumEntry(input)).toMatchObject({
    decision: 'SKIP',
    reasonCode: 'INVALID_INPUT',
  });
});
