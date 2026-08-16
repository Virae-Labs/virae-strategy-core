import {
  DEFAULT_MUSK_TWEET_STRATEGY_CONFIG,
  decideMuskTweetCountEntry,
  evaluateMuskTweetNextMarketPreposition,
  evaluateMuskTweetStrategy,
  normalizeMuskTweetStrategyConfig,
  normalizeMuskTweetSimulationConfig,
  resolveMuskTweetPersistentRiskStop,
  selectMuskEvaluationSnapshots,
} from '..';
import type { MuskTweetMarket, MuskTweetSnapshot } from '../types';

const nowSec = 2_000_000_000;
const nowIso = new Date(nowSec * 1_000).toISOString();

function market(status: 'active' | 'upcoming', startOffsetSec = -3_600): MuskTweetMarket {
  return {
    eventSlug: `musk-${status}`,
    title: `Musk ${status}`,
    startAt: new Date((nowSec + startOffsetSec) * 1_000).toISOString(),
    endAt: new Date((nowSec + 21_600) * 1_000).toISOString(),
    status,
    ranges: [
      { label: '<40', minInclusive: 0, maxInclusive: 39, yesTokenId: `${status}-low-yes`, noTokenId: `${status}-low-no` },
      { label: '40-59', minInclusive: 40, maxInclusive: 59, yesTokenId: `${status}-main-yes`, noTokenId: `${status}-main-no` },
      { label: '90-114', minInclusive: 90, maxInclusive: 114, yesTokenId: `${status}-high-yes`, noTokenId: `${status}-high-no` },
      { label: '115+', minInclusive: 115, maxInclusive: null, yesTokenId: `${status}-lottery-yes`, noTokenId: `${status}-lottery-no` },
    ],
  };
}

function snapshot(overrides: Partial<MuskTweetSnapshot> = {}): MuskTweetSnapshot {
  const baseMarket = market('active');
  return {
    id: 'snapshot-current',
    capturedAt: nowIso,
    market: baseMarket,
    counter: { count: 39, source: 'xtracker', fresh: true, updatedAt: nowIso },
    rates: { rate30m: 0, rate60m: 0, rate2h: 1, rate6h: 1, rate24h: 1, cooldownHours: 0, eventFactor: 'normal' },
    remainingHours: 6,
    orderbooks: baseMarket.ranges.flatMap((range) => [
      { tokenId: range.yesTokenId, minOrderSize: 0.5, bestBid: 0.49, bestAsk: 0.5, spread: 0.01, topDepthUsd: 100, fresh: true, source: 'REST' as const },
      { tokenId: range.noTokenId, minOrderSize: 0.5, bestBid: 0.94, bestAsk: 0.95, spread: 0.01, topDepthUsd: 100, fresh: true, source: 'REST' as const },
    ]),
    diagnostics: [],
    ...overrides,
  };
}

test('keeps the live task default at exactly 1,000 USD and produces a current-market intent', () => {
  expect(DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry.maxNotionalUsd).toBe(1_000);
  expect(normalizeMuskTweetStrategyConfig({}).entry.maxNotionalUsd).toBe(1_000);
  expect(evaluateMuskTweetStrategy(snapshot(), DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry, nowSec).intents)
    .toEqual(expect.arrayContaining([expect.objectContaining({ strategy: 'TAIL_NO_LOW', amount: 187.5 })]));
});

test('produces deterministic intents from an explicit clock', () => {
  const input = snapshot();
  const config = { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry, minOrderNotionalUsd: 0.1 };
  const first = evaluateMuskTweetStrategy(input, config, nowSec);
  const second = evaluateMuskTweetStrategy(input, config, nowSec);
  expect(second).toEqual(first);
  expect(first.intents[0]).toMatchObject({
    id: expect.stringContaining('musk-tweet-count:'),
    intentKey: expect.stringContaining('musk-tweet-count:'),
    createdAt: nowIso,
  });
});

test('fails closed when XTracker counter freshness is false', () => {
  const result = evaluateMuskTweetStrategy(
    snapshot({ counter: { count: 39, source: 'xtracker', fresh: false, updatedAt: nowIso } }),
    { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry, minOrderNotionalUsd: 0.1 },
    nowSec,
  );
  expect(result.intents).toEqual([]);
  expect(result.rejected.some((intent) => intent.rejectionReason === 'COUNTER_STALE')).toBe(true);
  expect(result.diagnostics).toContain('Counter data is stale; new entries are blocked.');
});

test('fails closed when the selected orderbook quote is stale', () => {
  const input = snapshot();
  input.orderbooks = input.orderbooks.map((quote) => quote.tokenId === 'active-low-no'
    ? { ...quote, fresh: false }
    : quote);
  const result = evaluateMuskTweetStrategy(input, DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry, nowSec);
  expect(result.intents.some((intent) => intent.tokenId === 'active-low-no')).toBe(false);
  expect(result.rejected.find((intent) => intent.tokenId === 'active-low-no')?.rejectionReason)
    .toBe('ORDERBOOK_STALE');
});

test('enforces venue minimum shares without importing host order code', () => {
  const current = snapshot();
  current.orderbooks = current.orderbooks.map((quote) => quote.tokenId === 'active-low-no'
    ? { ...quote, minOrderSize: 1_000 }
    : quote);
  const result = evaluateMuskTweetStrategy(
    current,
    { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry, minOrderNotionalUsd: 0.1 },
    nowSec,
  );
  expect(result.rejected.find((intent) => intent.strategy === 'TAIL_NO_LOW')?.rejectionReason)
    .toBe('LIMIT_ORDER_SIZE_BELOW_MARKET_MINIMUM');
});

test('selects next-market preposition before current-market intents', () => {
  const current = snapshot();
  const nextMarket = market('upcoming', 3_600);
  const next = snapshot({
    id: 'snapshot-next',
    market: nextMarket,
    orderbooks: nextMarket.ranges.flatMap((range) => [
      { tokenId: range.yesTokenId, minOrderSize: 0.5, bestBid: 0.49, bestAsk: 0.5, spread: 0.01, topDepthUsd: 100, fresh: true, source: 'REST' as const },
      { tokenId: range.noTokenId, minOrderSize: 0.5, bestBid: 0.94, bestAsk: 0.95, spread: 0.01, topDepthUsd: 100, fresh: true, source: 'REST' as const },
    ]),
  });
  const decision = decideMuskTweetCountEntry({
    currentSnapshot: current,
    nextSnapshot: next,
    config: { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry, minOrderNotionalUsd: 0.1 },
    nowSec,
  });
  expect(decision.reasonCode).toBe('NEXT_MARKET_INTENT');
  expect(decision.selectedIntent?.strategy).toBe('NEXT_MARKET_PREPOSITION');
  expect(evaluateMuskTweetNextMarketPreposition(current, next, decision.currentEvaluation
    ? { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry, minOrderNotionalUsd: 0.1 }
    : DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry, nowSec).intents).toHaveLength(1);
});

test('selects active and chronologically first upcoming snapshots', () => {
  const active = snapshot();
  const later = snapshot({ id: 'later', market: market('upcoming', 7_200) });
  const earlier = snapshot({ id: 'earlier', market: market('upcoming', 3_600) });
  expect(selectMuskEvaluationSnapshots([later, active, earlier])).toEqual({
    currentSnapshot: active,
    nextSnapshot: earlier,
  });
});

test('normalizes live and simulation config independently', () => {
  const live = normalizeMuskTweetStrategyConfig({
    entryConfig: { maxNotionalUsd: 999, takeProfitEnabled: true, takeProfitPrice: 0.8 },
    riskConfig: { maxTaskNetLossUsd: '', maxTaskNetProfitUsd: 12, maxTradesPerDay: 4.8 },
  });
  expect(live.entry).toMatchObject({ maxNotionalUsd: 999, takeProfitEnabled: true, takeProfitPrice: 0.8 });
  expect(live.risk).toMatchObject({ maxTaskNetLossUsd: null, maxTaskNetProfitUsd: 12, maxTradesPerDay: 4 });
  expect(normalizeMuskTweetSimulationConfig({}).entry).toMatchObject({
    maxNotionalUsd: 1_000,
    minExpectedProfitUsd: 50,
  });
});

test('reports manual zero counters and missing strategy ranges', () => {
  const input = snapshot({
    market: { ...market('active'), ranges: [] },
    counter: { count: 0, source: 'manual', fresh: true, updatedAt: nowIso },
    orderbooks: [],
  });
  const result = evaluateMuskTweetStrategy(input, DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry);
  expect(result.diagnostics).toContain('Manual counter is zero; live execution should stay blocked unless this is intentional.');
  expect(result.checks).toEqual(expect.arrayContaining([
    expect.objectContaining({ strategy: 'TAIL_NO_LOW', blockers: ['LOW_RANGE_MISSING'] }),
    expect.objectContaining({ strategy: 'TAIL_NO_HIGH', blockers: ['HIGH_RANGE_MISSING'] }),
  ]));
});

test('covers breached tails, directional event factors, and lottery candidates', () => {
  const permissive = {
    ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry,
    minOrderNotionalUsd: 0.05,
    minExpectedProfitUsd: 0,
  };
  const breached = snapshot({ counter: { count: 120, source: 'xtracker', fresh: true, updatedAt: nowIso } });
  expect(evaluateMuskTweetStrategy(breached, permissive, nowSec).intents.map((intent) => intent.strategy))
    .toEqual(expect.arrayContaining(['TAIL_NO_LOW', 'TAIL_NO_HIGH']));

  for (const eventFactor of ['normal', 'burst', 'cooldown', 'special_event'] as const) {
    const directional = snapshot({
      counter: { count: 45, source: 'xtracker', fresh: true, updatedAt: nowIso },
      remainingHours: 3,
      rates: { rate30m: 0, rate60m: 0, rate2h: 1, rate6h: 1, rate24h: 1, cooldownHours: 0, eventFactor },
    });
    const result = evaluateMuskTweetStrategy(directional, permissive, nowSec);
    expect(result.checks.find((check) => check.strategy === 'DIRECTIONAL_LATE')?.status).toBe('eligible');
  }

  const lottery = snapshot({
    rates: { rate30m: 3, rate60m: 0, rate2h: 1, rate6h: 1, rate24h: 1, cooldownHours: 0, eventFactor: 'normal' },
  });
  lottery.orderbooks = lottery.orderbooks.map((quote) => quote.tokenId === 'active-lottery-yes'
    ? { ...quote, bestAsk: 0.02, minOrderSize: 0.1 }
    : quote);
  expect(evaluateMuskTweetStrategy(lottery, permissive, nowSec).intents.some((intent) => intent.strategy === 'LOTTERY_YES')).toBe(true);
});

test('blocks non-main directional ranges and burst runs without lottery ranges', () => {
  const onlyLow = market('active');
  onlyLow.ranges = [onlyLow.ranges[0]];
  const input = snapshot({
    market: onlyLow,
    remainingHours: 3,
    rates: { rate30m: 5, rate60m: 10, rate2h: 1, rate6h: 1, rate24h: 1, cooldownHours: 0, eventFactor: 'burst' },
    orderbooks: [],
  });
  const result = evaluateMuskTweetStrategy(input, { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry, minOrderNotionalUsd: 0.01 }, nowSec);
  expect(result.checks.find((check) => check.strategy === 'DIRECTIONAL_LATE')).toMatchObject({ status: 'blocked', blockers: ['DIRECTIONAL_RANGE_NOT_MAIN'] });
  expect(result.checks.find((check) => check.strategy === 'LOTTERY_YES')).toMatchObject({ status: 'blocked', blockers: ['NO_LOTTERY_RANGE'] });
});

test('covers every canonical selector outcome', () => {
  const empty = snapshot({ market: { ...market('active'), ranges: [] }, orderbooks: [] });
  const eligible = snapshot();
  const config = { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry, minOrderNotionalUsd: 0.1 };
  expect(decideMuskTweetCountEntry({ currentSnapshot: eligible, config, nowSec }).reasonCode).toBe('CURRENT_MARKET_INTENT');
  expect(decideMuskTweetCountEntry({
    currentSnapshot: snapshot({ counter: { count: 39, source: 'xtracker', fresh: false, updatedAt: nowIso } }),
    config: DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry,
    nowSec,
  }).reasonCode)
    .toBe('CURRENT_MARKET_REJECTED');

  const nextMarket = market('upcoming', 3_600);
  const rejectedNext = snapshot({
    market: nextMarket,
    orderbooks: nextMarket.ranges.map((range) => ({
      tokenId: range.noTokenId,
      minOrderSize: 0.1,
      bestBid: 0.97,
      bestAsk: 0.98,
      spread: 0.01,
      topDepthUsd: 100,
      fresh: true,
      source: 'REST' as const,
    })),
  });
  expect(decideMuskTweetCountEntry({ currentSnapshot: empty, nextSnapshot: rejectedNext, config, nowSec }).reasonCode)
    .toBe('NEXT_MARKET_REJECTED');
  expect(decideMuskTweetCountEntry({ currentSnapshot: null, nextSnapshot: rejectedNext, config, nowSec }).reasonCode)
    .toBe('NO_CANDIDATE');
});

test('treats out-of-window next markets as not applicable and just-started markets as low-tail candidates', () => {
  const current = snapshot();
  const farMarket = market('upcoming', 99 * 3_600);
  const far = snapshot({ market: farMarket, orderbooks: [] });
  expect(evaluateMuskTweetNextMarketPreposition(current, far, DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry, nowSec).checks[0].status)
    .toBe('not-applicable');

  const startedMarket = market('upcoming', -60);
  const started = snapshot({
    market: startedMarket,
    orderbooks: [{ tokenId: 'upcoming-low-no', minOrderSize: 0.1, bestBid: 0.94, bestAsk: 0.95, spread: 0.01, topDepthUsd: 100, fresh: true, source: 'REST' }],
  });
  expect(evaluateMuskTweetNextMarketPreposition(current, started, { ...DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry, minOrderNotionalUsd: 0.1 }, nowSec).intents[0].label)
    .toBe('<40 No');
});

test('requires fresh next-market counter and orderbook data', () => {
  const current = snapshot();
  const nextMarket = market('upcoming', 3_600);
  const next = snapshot({
    market: nextMarket,
    counter: { count: 39, source: 'xtracker', fresh: false, updatedAt: nowIso },
    orderbooks: [{ tokenId: 'upcoming-high-no', minOrderSize: 0.1, bestBid: 0.94, bestAsk: 0.95, spread: 0.01, topDepthUsd: 100, fresh: true, source: 'REST' }],
  });
  const staleCounter = evaluateMuskTweetNextMarketPreposition(current, next, DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry, nowSec);
  expect(staleCounter.rejected[0].rejectionReason).toBe('COUNTER_STALE');

  next.counter = { ...next.counter, fresh: true };
  next.orderbooks = next.orderbooks.map((quote) => ({ ...quote, fresh: false }));
  const staleBook = evaluateMuskTweetNextMarketPreposition(current, next, DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry, nowSec);
  expect(staleBook.rejected[0].rejectionReason).toBe('ORDERBOOK_STALE');
});

test('fails closed with stable reason codes for invalid timestamps', () => {
  const invalidCapturedAt = snapshot({ capturedAt: 'not-a-date' });
  expect(evaluateMuskTweetStrategy(invalidCapturedAt, DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry))
    .toMatchObject({ inputErrorCode: 'INVALID_NOW_SEC', intents: [], rejected: [] });
  expect(decideMuskTweetCountEntry({
    currentSnapshot: snapshot(),
    config: DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry,
    nowSec: Number.NaN,
  })).toMatchObject({ reasonCode: 'INVALID_INPUT', selectedIntent: null });
  const cases = [
    [snapshot({ capturedAt: 'invalid' }), 'INVALID_SNAPSHOT_CAPTURED_AT'],
    [snapshot({ market: { ...market('active'), startAt: 'invalid' } }), 'INVALID_MARKET_START_AT'],
    [snapshot({ market: { ...market('active'), endAt: 'invalid' } }), 'INVALID_MARKET_END_AT'],
    [snapshot({ counter: { count: 39, source: 'xtracker', fresh: true, updatedAt: 'invalid' } }), 'INVALID_COUNTER_UPDATED_AT'],
  ] as const;
  for (const [input, inputErrorCode] of cases) {
    expect(evaluateMuskTweetStrategy(input, DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry, nowSec))
      .toMatchObject({ inputErrorCode, intents: [], rejected: [] });
  }
});

test('does not treat the 115+ lottery range as the 90-114 high-tail range', () => {
  const input = snapshot();
  input.market = { ...input.market, ranges: [input.market.ranges[3], input.market.ranges[0]] };
  const result = evaluateMuskTweetStrategy(input, DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry, nowSec);
  expect(result.checks.find((item) => item.strategy === 'TAIL_NO_HIGH')).toMatchObject({
    status: 'not-applicable',
    blockers: ['HIGH_RANGE_MISSING'],
  });
});

test('resolves every persistent risk stop and the no-stop path', () => {
  const base = {
    maxTaskNetLossUsd: null,
    maxTaskNetProfitUsd: null,
    risk: { dailyLossUsd: 0, taskNetLossUsd: 0, tradesToday: 0 },
    orderSizingMode: 'FIXED_ORDER_AMOUNT' as const,
    taskEquityUsd: 10,
    minRemainingBankrollUsd: null,
  };
  expect(resolveMuskTweetPersistentRiskStop({
    ...base,
    maxTaskNetProfitUsd: 5,
    risk: { ...base.risk, taskNetAfterFeePnlUsd: 5 },
  })).toBe('TASK_NET_PROFIT_STOP');
  expect(resolveMuskTweetPersistentRiskStop({
    ...base,
    maxTaskNetLossUsd: 5,
    risk: { ...base.risk, taskNetPnlUsd: -5 },
  })).toBe('TASK_NET_LOSS_STOP');
  expect(resolveMuskTweetPersistentRiskStop({
    ...base,
    orderSizingMode: 'TASK_BANKROLL',
    taskEquityUsd: 4,
    minRemainingBankrollUsd: 5,
  })).toBe('TASK_BANKROLL_FLOOR_STOP');
  expect(resolveMuskTweetPersistentRiskStop({
    ...base,
    orderSizingMode: 'TASK_BANKROLL',
    maxTaskNetLossUsd: 5,
    risk: { ...base.risk, taskNetPnlUsd: -5 },
  })).toBe('TASK_NET_LOSS_STOP');
  expect(resolveMuskTweetPersistentRiskStop({
    ...base,
    orderSizingMode: 'FRACTIONAL_KELLY',
    maxTaskNetLossUsd: 5,
    risk: { ...base.risk, taskNetPnlUsd: -5 },
  })).toBe('TASK_NET_LOSS_STOP');
});
