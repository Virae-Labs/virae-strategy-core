import { normalizePreMarketStrategyConfig, preMarketPricesForMode } from '../config';
import { buildPreMarketEntryPlan, buildPreMarketTakeProfitIntents } from '../execution';

const round = {
  roundKey: 'btc-updown-15m-1000', roundStartSec: 1000, roundEndSec: 1900, nowSec: 760,
  marketActive: true, acceptingOrders: true, upTokenId: 'up', downTokenId: 'down',
};

test('builds twelve deterministic, budget-conserving entry intents', () => {
  const result = buildPreMarketEntryPlan({ round, config: { sideBudgetUsd: 10, cancelAfterOpenSeconds: 20 } });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.intents).toHaveLength(12);
  expect(new Set(result.intents.map((intent) => intent.intentKey)).size).toBe(12);
  expect(result.intents.filter((intent) => intent.outcome === 'Up').reduce((sum, intent) => sum + intent.notionalUsd, 0)).toBeCloseTo(10);
  expect(result.intents.slice(0, 6).map((intent) => intent.price)).toEqual([0.4, 0.3, 0.24, 0.18, 0.12, 0.06]);
  expect(result.cancelAtSec).toBe(1020);
});

test('keeps all ladder modes cent-rounded in parity with the host strategy', () => {
  expect(preMarketPricesForMode('SAFE')).toEqual([0.36, 0.27, 0.22, 0.17, 0.11, 0.06]);
  expect(preMarketPricesForMode('NORMAL')).toEqual([0.4, 0.3, 0.24, 0.18, 0.12, 0.06]);
  expect(preMarketPricesForMode('AGGRESSIVE')).toEqual([0.44, 0.33, 0.27, 0.2, 0.14, 0.07]);
});

test('fails closed outside the launch window', () => {
  expect(buildPreMarketEntryPlan({ round: { ...round, nowSec: 700 } })).toEqual({ ok: false, reasonCode: 'OUTSIDE_LAUNCH_WINDOW' });
  expect(buildPreMarketEntryPlan({ round: { ...round, nowSec: 1016 } })).toEqual({ ok: false, reasonCode: 'OUTSIDE_LAUNCH_WINDOW' });
});

test('includes both exact launch-window boundaries', () => {
  expect(buildPreMarketEntryPlan({ round: { ...round, nowSec: 760 } }).ok).toBe(true);
  expect(buildPreMarketEntryPlan({ round: { ...round, nowSec: 1015 } }).ok).toBe(true);
});

test.each([
  { roundKey: '', expected: 'INVALID_ROUND' },
  { roundStartSec: Number.NaN, expected: 'INVALID_ROUND' },
  { roundEndSec: 1000, expected: 'INVALID_ROUND' },
  { nowSec: Number.POSITIVE_INFINITY, expected: 'INVALID_ROUND' },
  { marketActive: false, expected: 'MARKET_UNAVAILABLE' },
  { acceptingOrders: false, expected: 'MARKET_UNAVAILABLE' },
  { upTokenId: '  ', expected: 'TOKEN_IDS_MISSING' },
  { downTokenId: '', expected: 'TOKEN_IDS_MISSING' },
  { upTokenId: ' up', expected: 'TOKEN_IDS_INVALID' },
  { downTokenId: 'up', expected: 'TOKEN_IDS_INVALID' },
])('fails closed for invalid round input %#', (override) => {
  const { expected, ...values } = override;
  expect(buildPreMarketEntryPlan({ round: { ...round, ...values } })).toEqual({ ok: false, reasonCode: expected });
});

test('validates every configurable timing boundary', () => {
  expect(() => normalizePreMarketStrategyConfig({ launchGraceSeconds: Number.POSITIVE_INFINITY })).toThrow('launch grace');
  expect(() => normalizePreMarketStrategyConfig({ launchGraceSeconds: -1 })).toThrow('launch grace');
  expect(normalizePreMarketStrategyConfig({ launchGraceSeconds: 0 }).launchGraceSeconds).toBe(0);
  expect(normalizePreMarketStrategyConfig({ launchGraceSeconds: 60 }).launchGraceSeconds).toBe(60);
});

test.each([
  [{ mode: 'UNKNOWN' }, 'ladder mode'],
  [{ sideBudgetUsd: 9.99 }, 'side budget'],
  [{ sideBudgetUsd: 100.01 }, 'side budget'],
  [{ cancelAfterOpenSeconds: 30 }, 'cancel window'],
  [{ launchLeadSeconds: 29 }, 'launch lead'],
  [{ launchLeadSeconds: 30.5 }, 'launch lead'],
  [{ takeProfitDelaySeconds: 901 }, 'take-profit delay'],
  [{ minimumTakeProfitPrice: 1 }, 'minimum take-profit price'],
  [{ takeProfitMultiplier: Number.NaN }, 'take-profit multiplier'],
])('rejects invalid config %p', (input, message) => {
  expect(() => normalizePreMarketStrategyConfig(input as never)).toThrow(message as string);
});

test('builds take profit from actual fills only', () => {
  const intents = buildPreMarketTakeProfitIntents({
    roundKey: round.roundKey, roundStartSec: 1000, nowSec: 1300,
    positions: [
      { outcome: 'Up', tokenId: 'up', filledShares: 4, filledNotionalUsd: 1, bestAsk: 0.55 },
      { outcome: 'Down', tokenId: 'down', filledShares: 0, filledNotionalUsd: 0, bestAsk: 0.7 },
    ],
  });
  expect(intents).toEqual([expect.objectContaining({ outcome: 'Up', price: 0.6, shares: 4 })]);
});

test('aggregates ladder fills into one take-profit intent per outcome', () => {
  const intents = buildPreMarketTakeProfitIntents({
    roundKey: round.roundKey, roundStartSec: 1000, nowSec: 1300,
    positions: [
      { outcome: 'Up', tokenId: 'up', filledShares: 1, filledNotionalUsd: 0.2, bestAsk: 0.61 },
      { outcome: 'Up', tokenId: 'up', filledShares: 2, filledNotionalUsd: 0.8, bestAsk: 0.65 },
    ],
  });
  expect(intents).toEqual([expect.objectContaining({
    intentKey: `${round.roundKey}:TAKE_PROFIT:UP`, price: 0.67, shares: 3,
  })]);
});

test('returns take-profit outcomes in canonical order regardless of fill order', () => {
  const intents = buildPreMarketTakeProfitIntents({
    roundKey: round.roundKey, roundStartSec: 1000, nowSec: 1300,
    positions: [
      { outcome: 'Down', tokenId: 'down', filledShares: 1, filledNotionalUsd: 0.2, bestAsk: null },
      { outcome: 'Up', tokenId: 'up', filledShares: 1, filledNotionalUsd: 0.2, bestAsk: null },
    ],
  });
  expect(intents.map((intent) => intent.outcome)).toEqual(['Up', 'Down']);
});

test('applies take-profit delay, floor, best ask, and price cap', () => {
  const position = { outcome: 'Up' as const, tokenId: 'up', filledShares: 2, filledNotionalUsd: 0.4, bestAsk: 0.7 };
  expect(buildPreMarketTakeProfitIntents({ roundKey: round.roundKey, roundStartSec: 1000, nowSec: 1299, positions: [position] })).toEqual([]);
  expect(buildPreMarketTakeProfitIntents({ roundKey: round.roundKey, roundStartSec: 1000, nowSec: 1300, positions: [position] })[0].price).toBe(0.7);
  expect(buildPreMarketTakeProfitIntents({
    roundKey: round.roundKey, roundStartSec: 1000, nowSec: 1300,
    positions: [{ ...position, filledNotionalUsd: 1.8, bestAsk: null }],
  })[0].price).toBe(0.99);
});

test('does not emit zero-share take-profit intents for dust', () => {
  expect(buildPreMarketTakeProfitIntents({
    roundKey: round.roundKey, roundStartSec: 1000, nowSec: 1300,
    positions: [{ outcome: 'Up', tokenId: 'up', filledShares: 0.009, filledNotionalUsd: 0.001, bestAsk: null }],
  })).toEqual([]);
});

test('fails closed for malformed take-profit input or conflicting outcome tokens', () => {
  const valid = { outcome: 'Up' as const, tokenId: 'up', filledShares: 1, filledNotionalUsd: 0.2, bestAsk: null };
  expect(buildPreMarketTakeProfitIntents({ roundKey: '', roundStartSec: 1000, nowSec: 1300, positions: [valid] })).toEqual([]);
  expect(buildPreMarketTakeProfitIntents({ roundKey: round.roundKey, roundStartSec: Number.NaN, nowSec: 1300, positions: [valid] })).toEqual([]);
  expect(buildPreMarketTakeProfitIntents({ roundKey: round.roundKey, roundStartSec: 1000, nowSec: 1300, positions: [{ ...valid, bestAsk: Number.POSITIVE_INFINITY }] })).toEqual([]);
  expect(buildPreMarketTakeProfitIntents({ roundKey: round.roundKey, roundStartSec: 1000, nowSec: 1300, positions: [{ ...valid, outcome: 'Sideways' as never }] })).toEqual([]);
  expect(buildPreMarketTakeProfitIntents({
    roundKey: round.roundKey, roundStartSec: 1000, nowSec: 1300,
    positions: [valid, { ...valid, tokenId: 'different-up-token' }],
  })).toEqual([]);
});
