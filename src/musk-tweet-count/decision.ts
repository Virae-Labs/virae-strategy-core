import type {
  MuskTweetEntryConfig,
  MuskTweetEvaluation,
  MuskTweetInputErrorCode,
  MuskTweetMarketRange,
  MuskTweetOrderbookQuote,
  MuskTweetSnapshot,
  MuskTweetStrategyCheck,
  MuskTweetStrategyId,
  MuskTweetTradeIntent,
} from './types';
import { money } from './utils';

export function evaluateMuskTweetStrategy(
  snapshot: MuskTweetSnapshot,
  config: MuskTweetEntryConfig,
  nowSec: number = Date.parse(snapshot.capturedAt) / 1_000,
): MuskTweetEvaluation {
  const inputError = validateEvaluationInput(snapshot, nowSec);
  if (inputError) return invalidEvaluation(inputError.code, inputError.message);
  const intents: MuskTweetTradeIntent[] = [];
  const rejected: MuskTweetTradeIntent[] = [];
  const checks: MuskTweetStrategyCheck[] = [];
  const diagnostics: string[] = [];
  const count = snapshot.counter.count;

  if (!snapshot.counter.fresh) diagnostics.push('Counter data is stale; new entries are blocked.');

  evaluateLowTailNo(snapshot, config, intents, rejected, checks, nowSec);
  evaluateHighTailNo(snapshot, config, intents, rejected, checks, nowSec);
  evaluateLateDirectional(snapshot, config, intents, rejected, checks, nowSec);
  evaluateLotteryYes(snapshot, config, intents, rejected, checks, nowSec);

  if (!count && snapshot.counter.source === 'manual') {
    diagnostics.push('Manual counter is zero; live execution should stay blocked unless this is intentional.');
  }

  return { intents, rejected, checks, diagnostics };
}

export function evaluateMuskTweetNextMarketPreposition(
  current: MuskTweetSnapshot,
  next: MuskTweetSnapshot,
  config: MuskTweetEntryConfig,
  nowSec: number = Date.parse(current.capturedAt) / 1_000,
): MuskTweetEvaluation {
  const currentInputError = validateEvaluationInput(current, nowSec);
  if (currentInputError) return invalidEvaluation(currentInputError.code, currentInputError.message);
  const nextInputError = validateSnapshotTimes(next);
  if (nextInputError) return invalidEvaluation(nextInputError.code, nextInputError.message);
  const intents: MuskTweetTradeIntent[] = [];
  const rejected: MuskTweetTradeIntent[] = [];
  const checks: MuskTweetStrategyCheck[] = [];
  const diagnostics: string[] = [];
  const startsInHours = (Date.parse(next.market.startAt) / 1_000 - nowSec) / 3_600;
  const justStarted = startsInHours <= 0 && startsInHours >= -0.5;
  const upcomingSoon = startsInHours > 0 && startsInHours <= config.nextMarketPrepositionMaxHours;
  const lowRange = findLowTailRange(next.market.ranges);
  const highRange = findRangeOverlapping(next.market.ranges, 90, 114);
  const targetRange = upcomingSoon ? highRange : justStarted ? lowRange : null;

  if (!targetRange) {
    checks.push(check('NEXT_MARKET_PREPOSITION', 'not-applicable', 'No next-market preposition setup is active.', []));
    return { intents, rejected, checks, diagnostics };
  }

  const tokenId = noToken(targetRange);
  const quote = quoteFor(next.orderbooks, tokenId);
  const amount = money(config.maxNotionalUsd * config.nextMarketPrepositionPct);
  const candidate = intent({
    strategy: 'NEXT_MARKET_PREPOSITION',
    tokenId,
    label: `${targetRange.label} No`,
    side: 'BUY',
    limitPrice: askIsUsable(quote) ? quote.bestAsk : 0.95,
    amount,
    amountKind: 'NOTIONAL',
    reason: upcomingSoon ? 'Upcoming next Musk tweet-count market has a preposition No setup.' : 'New Musk tweet-count market just started; small low-tail No preposition.',
    ttlSeconds: config.entryOrderTtlSeconds,
    nowSec,
  });

  const blockers = [
    ...(!current.counter.fresh || !next.counter.fresh ? ['COUNTER_STALE'] : []),
    ...quoteBlockers(quote, 'NO_TRADABLE_ASK'),
    ...(amount < config.minOrderNotionalUsd ? ['ORDER_NOTIONAL_BELOW_MINIMUM'] : []),
    ...minimumOrderSizeBlockers(quote, amount, candidate.limitPrice),
    ...(askIsUsable(quote) && quote.bestAsk > 0.97 ? ['ASK_TOO_HIGH'] : []),
  ];

  if (blockers.length) rejected.push(reject(candidate, blockers[0]));
  else intents.push(candidate);
  checks.push(check(
    'NEXT_MARKET_PREPOSITION',
    blockers.length ? 'blocked' : 'eligible',
    blockers.length ? 'Next-market preposition is blocked by current gates.' : 'Next-market preposition is eligible.',
    blockers,
    candidate,
  ));
  return { intents, rejected, checks, diagnostics };
}

export type MuskTweetCountEntryDecision = {
  selectedIntent: MuskTweetTradeIntent | null;
  selectedEvaluation: MuskTweetEvaluation | null;
  currentEvaluation: MuskTweetEvaluation | null;
  nextEvaluation: MuskTweetEvaluation | null;
  reasonCode: 'NEXT_MARKET_INTENT' | 'CURRENT_MARKET_INTENT' | 'NEXT_MARKET_REJECTED' | 'CURRENT_MARKET_REJECTED' | 'INVALID_INPUT' | 'NO_CANDIDATE';
};

/**
 * Canonical deterministic selector used by live hosts and replay tooling.
 * The host supplies time explicitly so the same snapshots always produce the
 * same decision and intent key.
 */
export function decideMuskTweetCountEntry(params: {
  currentSnapshot: MuskTweetSnapshot | null;
  nextSnapshot?: MuskTweetSnapshot | null;
  config: MuskTweetEntryConfig;
  nowSec: number;
}): MuskTweetCountEntryDecision {
  const currentEvaluation = params.currentSnapshot
    ? evaluateMuskTweetStrategy(params.currentSnapshot, params.config, params.nowSec)
    : null;
  if (currentEvaluation?.inputErrorCode) {
    return { selectedIntent: null, selectedEvaluation: currentEvaluation, currentEvaluation, nextEvaluation: null, reasonCode: 'INVALID_INPUT' };
  }
  const nextEvaluation = params.currentSnapshot && params.nextSnapshot
    ? evaluateMuskTweetNextMarketPreposition(
      params.currentSnapshot,
      params.nextSnapshot,
      params.config,
      params.nowSec,
    )
    : null;
  const nextIntent = nextEvaluation?.intents.find((intent) => intent.side === 'BUY');
  if (nextIntent) return { selectedIntent: nextIntent, selectedEvaluation: nextEvaluation, currentEvaluation, nextEvaluation, reasonCode: 'NEXT_MARKET_INTENT' };
  const currentIntent = currentEvaluation?.intents.find((intent) => intent.side === 'BUY');
  if (currentIntent) return { selectedIntent: currentIntent, selectedEvaluation: currentEvaluation, currentEvaluation, nextEvaluation, reasonCode: 'CURRENT_MARKET_INTENT' };
  if (nextEvaluation?.inputErrorCode) return { selectedIntent: null, selectedEvaluation: nextEvaluation, currentEvaluation, nextEvaluation, reasonCode: 'INVALID_INPUT' };
  const nextRejected = nextEvaluation?.rejected[0];
  if (nextRejected) return { selectedIntent: nextRejected, selectedEvaluation: nextEvaluation, currentEvaluation, nextEvaluation, reasonCode: 'NEXT_MARKET_REJECTED' };
  const currentRejected = currentEvaluation?.rejected[0];
  if (currentRejected) return { selectedIntent: currentRejected, selectedEvaluation: currentEvaluation, currentEvaluation, nextEvaluation, reasonCode: 'CURRENT_MARKET_REJECTED' };
  return { selectedIntent: null, selectedEvaluation: null, currentEvaluation, nextEvaluation, reasonCode: 'NO_CANDIDATE' };
}

function evaluateLowTailNo(
  snapshot: MuskTweetSnapshot,
  config: MuskTweetEntryConfig,
  intents: MuskTweetTradeIntent[],
  rejected: MuskTweetTradeIntent[],
  checks: MuskTweetStrategyCheck[],
  nowSec: number,
) {
  const range = findLowTailRange(snapshot.market.ranges);
  if (!range) {
    checks.push(check('TAIL_NO_LOW', 'not-applicable', 'No <40 / low-tail range exists.', ['LOW_RANGE_MISSING']));
    return;
  }
  const quote = quoteFor(snapshot.orderbooks, noToken(range));
  const breachCount = range.maxInclusive == null ? 40 : range.maxInclusive + 1;
  const count = snapshot.counter.count;
  const nearBoundary = count >= Math.max(0, breachCount - config.lowTailBoundaryBufferTweets) && count < breachCount;
  const watchSize = count < 30 && snapshot.remainingHours >= 8 && hasBurst(snapshot, config) && askIsUsable(quote) && quote.bestAsk >= 0.9 && quote.bestAsk <= 0.94;
  const amount = money(config.maxNotionalUsd * config.tailNoAllocationPct * (watchSize ? 0.1 : 0.25));
  const candidate = intent({
    strategy: 'TAIL_NO_LOW',
    tokenId: noToken(range),
    label: `${range.label} No`,
    side: 'BUY',
    limitPrice: askIsUsable(quote) ? Math.min(quote.bestAsk, count >= breachCount ? 0.995 : 0.97) : 0.97,
    amount,
    amountKind: 'NOTIONAL',
    reason: count >= breachCount ? 'Low boundary is already breached.' : watchSize ? 'Small watch-size low-tail No entry during an active burst.' : 'Count is near low boundary with enough time remaining.',
    ttlSeconds: config.entryOrderTtlSeconds,
    nowSec,
  });
  const deterministicProfit = expectedBinaryProfitUsd(amount, candidate.limitPrice);
  const stateOk = count >= breachCount || (nearBoundary && snapshot.remainingHours >= 4) || watchSize;
  const priceOk = askIsUsable(quote) && ((count >= breachCount && quote.bestAsk <= 0.995) || (nearBoundary && quote.bestAsk >= config.lowTailMinAsk && quote.bestAsk <= config.lowTailMaxAsk) || watchSize);
  const blockers = blockersFrom({
    counterFresh: snapshot.counter.fresh,
    amount,
    minOrderNotionalUsd: config.minOrderNotionalUsd,
    extra: [
      ...quoteBlockers(quote, 'NO_TRADABLE_ASK'),
      ...minimumOrderSizeBlockers(quote, amount, candidate.limitPrice),
      ...(!stateOk ? ['LOW_NO_STATE_NOT_ATTRACTIVE'] : []),
      ...(!priceOk ? ['LOW_NO_PRICE_NOT_ATTRACTIVE'] : []),
      ...(count >= breachCount && deterministicProfit < config.minExpectedProfitUsd ? ['EXPECTED_PROFIT_TOO_SMALL'] : []),
    ],
  });
  if (blockers.length) rejected.push(reject(candidate, blockers[0]));
  else intents.push(candidate);
  checks.push(check('TAIL_NO_LOW', blockers.length ? 'blocked' : 'eligible', blockers.length ? 'Low-tail No is blocked.' : 'Low-tail No is eligible.', blockers, candidate));
}

function evaluateHighTailNo(
  snapshot: MuskTweetSnapshot,
  config: MuskTweetEntryConfig,
  intents: MuskTweetTradeIntent[],
  rejected: MuskTweetTradeIntent[],
  checks: MuskTweetStrategyCheck[],
  nowSec: number,
) {
  const range = findRangeOverlapping(snapshot.market.ranges, 90, 114);
  if (!range) {
    checks.push(check('TAIL_NO_HIGH', 'not-applicable', 'No 90-114 / high-tail range exists.', ['HIGH_RANGE_MISSING']));
    return;
  }
  const quote = quoteFor(snapshot.orderbooks, noToken(range));
  const count = snapshot.counter.count;
  const highMin = range.minInclusive;
  const highMax = range.maxInclusive ?? 115;
  const highBreached = count > highMax;
  const countInside = count >= highMin && count <= highMax;
  const specialEventActive = snapshot.rates.eventFactor === 'special_event';
  const amount = money(config.maxNotionalUsd * config.tailNoAllocationPct * 0.15);
  const candidate = intent({
    strategy: 'TAIL_NO_HIGH',
    tokenId: noToken(range),
    label: `${range.label} No`,
    side: 'BUY',
    limitPrice: askIsUsable(quote) ? Math.min(quote.bestAsk, highBreached ? 0.995 : 0.95) : highBreached ? 0.995 : 0.95,
    amount,
    amountKind: 'NOTIONAL',
    reason: highBreached ? 'High range is already breached.' : 'Upper-middle No candidate based on count and remaining time.',
    ttlSeconds: config.entryOrderTtlSeconds,
    nowSec,
  });
  const stateOk = highBreached || (count < 65 && snapshot.remainingHours <= config.highTailMaxRemainingHours);
  const priceOk = askIsUsable(quote) && ((highBreached && quote.bestAsk <= 0.995) || (count < 65 && quote.bestAsk >= config.highTailMinAsk && quote.bestAsk <= config.highTailMaxAsk));
  const blockers = blockersFrom({
    counterFresh: snapshot.counter.fresh,
    amount,
    minOrderNotionalUsd: config.minOrderNotionalUsd,
    extra: [
      ...quoteBlockers(quote, 'NO_TRADABLE_ASK'),
      ...minimumOrderSizeBlockers(quote, amount, candidate.limitPrice),
      ...(specialEventActive && !highBreached ? ['SPECIAL_EVENT_HIGH_NO_REDUCED'] : []),
      ...(countInside ? ['COUNT_INSIDE_HIGH_RANGE'] : []),
      ...(!stateOk ? ['HIGH_NO_STATE_NOT_ATTRACTIVE'] : []),
      ...(!priceOk ? ['HIGH_NO_PRICE_NOT_ATTRACTIVE'] : []),
      ...(highBreached && expectedBinaryProfitUsd(amount, candidate.limitPrice) < config.minExpectedProfitUsd ? ['EXPECTED_PROFIT_TOO_SMALL'] : []),
    ],
  });
  if (blockers.length) rejected.push(reject(candidate, blockers[0]));
  else intents.push(candidate);
  checks.push(check('TAIL_NO_HIGH', blockers.length ? 'blocked' : 'eligible', blockers.length ? 'High-tail No is blocked.' : 'High-tail No is eligible.', blockers, candidate));
}

function evaluateLateDirectional(
  snapshot: MuskTweetSnapshot,
  config: MuskTweetEntryConfig,
  intents: MuskTweetTradeIntent[],
  rejected: MuskTweetTradeIntent[],
  checks: MuskTweetStrategyCheck[],
  nowSec: number,
) {
  if (snapshot.remainingHours < config.directionalMinRemainingHours || snapshot.remainingHours > config.directionalMaxRemainingHours) {
    checks.push(check('DIRECTIONAL_LATE', 'not-applicable', `Late directional only runs with ${config.directionalMinRemainingHours}-${config.directionalMaxRemainingHours} hours remaining.`, []));
    return;
  }
  const projected = snapshot.counter.count + snapshot.remainingHours * adjustedHourlyRate(snapshot);
  const range = snapshot.market.ranges.find((item) => projected >= item.minInclusive && projected <= (item.maxInclusive ?? Number.POSITIVE_INFINITY));
  if (!range || !yesToken(range) || !isMainDirectionalRange(range)) {
    checks.push(check('DIRECTIONAL_LATE', 'blocked', 'No main directional range matched the projected final count.', ['DIRECTIONAL_RANGE_NOT_MAIN']));
    return;
  }
  const quote = quoteFor(snapshot.orderbooks, yesToken(range));
  const amount = money(config.maxNotionalUsd * config.lateDirectionalAllocationPct * 0.2);
  const candidate = intent({
    strategy: 'DIRECTIONAL_LATE',
    tokenId: yesToken(range),
    label: `${range.label} Yes`,
    side: 'BUY',
    limitPrice: askIsUsable(quote) ? quote.bestAsk : 0.5,
    amount,
    amountKind: 'NOTIONAL',
    reason: `Projected final count is ${projected.toFixed(1)}.`,
    ttlSeconds: config.entryOrderTtlSeconds,
    nowSec,
  });
  const blockers = blockersFrom({
    counterFresh: snapshot.counter.fresh,
    amount,
    minOrderNotionalUsd: config.minOrderNotionalUsd,
    extra: [
      ...quoteBlockers(quote, 'NO_DIRECTIONAL_ASK'),
      ...minimumOrderSizeBlockers(quote, amount, candidate.limitPrice),
      ...(askIsUsable(quote) && quote.bestAsk > 0.72 ? ['DIRECTIONAL_ASK_TOO_HIGH'] : []),
    ],
  });
  if (blockers.length) rejected.push(reject(candidate, blockers[0]));
  else intents.push(candidate);
  checks.push(check('DIRECTIONAL_LATE', blockers.length ? 'blocked' : 'eligible', blockers.length ? 'Late directional is blocked.' : 'Late directional is eligible.', blockers, candidate));
}

function evaluateLotteryYes(
  snapshot: MuskTweetSnapshot,
  config: MuskTweetEntryConfig,
  intents: MuskTweetTradeIntent[],
  rejected: MuskTweetTradeIntent[],
  checks: MuskTweetStrategyCheck[],
  nowSec: number,
) {
  if (!hasBurst(snapshot, config)) {
    checks.push(check('LOTTERY_YES', 'not-applicable', 'Lottery Yes only runs after a burst trigger.', []));
    return;
  }
  const ranges = snapshot.market.ranges.filter((range) => range.minInclusive >= 115 && yesToken(range));
  const candidates = ranges.map((range) => {
    const quote = quoteFor(snapshot.orderbooks, yesToken(range));
    const amount = money(config.maxNotionalUsd * Math.min(config.lotteryAllocationPct, config.lotteryMaxSingleTradePct));
    const candidate = intent({
      strategy: 'LOTTERY_YES',
      tokenId: yesToken(range),
      label: `${range.label} Yes`,
      side: 'BUY',
      limitPrice: askIsUsable(quote) ? quote.bestAsk : 0.02,
      amount,
      amountKind: 'NOTIONAL',
      reason: 'Burst trigger is active and far Yes is priced like a lottery ticket.',
      ttlSeconds: config.entryOrderTtlSeconds,
      nowSec,
    });
    const priceOk = askIsUsable(quote) && quote.bestAsk >= 0.005 && quote.bestAsk <= 0.03;
    return {
      candidate,
      blockers: blockersFrom({
        counterFresh: snapshot.counter.fresh,
        amount,
        minOrderNotionalUsd: config.minOrderNotionalUsd,
        extra: [
          ...quoteBlockers(quote, 'NO_TRADABLE_ASK'),
          ...minimumOrderSizeBlockers(quote, amount, candidate.limitPrice),
          ...(priceOk ? [] : ['LOTTERY_YES_PRICE_NOT_ATTRACTIVE']),
        ],
      }),
    };
  });
  const eligible = candidates.find((item) => !item.blockers.length);
  if (eligible) intents.push(eligible.candidate);
  else if (candidates[0]) rejected.push(reject(candidates[0].candidate, candidates[0].blockers[0] || 'NO_LOTTERY_RANGE'));
  checks.push(check('LOTTERY_YES', eligible ? 'eligible' : 'blocked', eligible ? 'Lottery Yes is eligible.' : 'Lottery Yes is blocked.', eligible ? [] : (candidates[0]?.blockers || ['NO_LOTTERY_RANGE']), eligible?.candidate || candidates[0]?.candidate));
}

function intent(params: Omit<MuskTweetTradeIntent, 'id' | 'intentKey' | 'status' | 'createdAt'> & { nowSec: number }): MuskTweetTradeIntent {
  const { nowSec, ...intentParams } = params;
  const intentKey = [
    'musk-tweet-count',
    params.strategy,
    params.tokenId,
    params.side,
    params.limitPrice,
    params.amountKind,
    params.amount,
  ].join(':');
  return {
    ...intentParams,
    id: intentKey,
    intentKey,
    status: 'generated',
    createdAt: new Date(nowSec * 1_000).toISOString(),
  };
}

function reject(base: MuskTweetTradeIntent, reason: string): MuskTweetTradeIntent {
  return { ...base, status: 'rejected', rejectionReason: reason };
}

function check(
  strategy: MuskTweetStrategyId,
  status: MuskTweetStrategyCheck['status'],
  reason: string,
  blockers: string[],
  candidate?: MuskTweetTradeIntent,
): MuskTweetStrategyCheck {
  return {
    strategy,
    status,
    reason,
    blockers,
    target: candidate?.label ?? null,
    amountUsd: candidate?.amountKind === 'NOTIONAL' ? candidate.amount : null,
    limitPrice: candidate?.limitPrice ?? null,
  };
}

function blockersFrom(params: { counterFresh: boolean; amount: number; minOrderNotionalUsd: number; extra: string[] }): string[] {
  return [
    ...(!params.counterFresh ? ['COUNTER_STALE'] : []),
    ...(params.amount < params.minOrderNotionalUsd ? ['ORDER_NOTIONAL_BELOW_MINIMUM'] : []),
    ...params.extra,
  ];
}

function quoteFor(orderbooks: MuskTweetOrderbookQuote[], tokenId: string): MuskTweetOrderbookQuote | undefined {
  return orderbooks.find((quote) => quote.tokenId === tokenId);
}

function askIsUsable(quote: MuskTweetOrderbookQuote | undefined): quote is MuskTweetOrderbookQuote & { bestAsk: number } {
  return Boolean(
    quote
    && quote.fresh
    && quote.source !== 'UNAVAILABLE'
    && Number.isFinite(quote.bestAsk)
    && quote.bestAsk != null
    && quote.bestAsk > 0
    && quote.bestAsk < 1,
  );
}

function quoteBlockers(quote: MuskTweetOrderbookQuote | undefined, unavailableCode: string): string[] {
  if (quote && !quote.fresh) return ['ORDERBOOK_STALE'];
  return askIsUsable(quote) ? [] : [unavailableCode];
}

function minimumOrderSizeBlockers(
  quote: MuskTweetOrderbookQuote | undefined,
  amountUsd: number,
  limitPrice: number,
): string[] {
  if (quote?.minOrderSize == null || !Number.isFinite(quote.minOrderSize) || quote.minOrderSize <= 0) {
    return ['MIN_ORDER_SIZE_UNAVAILABLE'];
  }
  if (!Number.isFinite(limitPrice) || limitPrice <= 0) return [];
  const plannedShares = Math.ceil((amountUsd / limitPrice) * 100 - 1e-9) / 100;
  return plannedShares + Number.EPSILON < quote.minOrderSize
    ? ['LIMIT_ORDER_SIZE_BELOW_MARKET_MINIMUM']
    : [];
}

function noToken(range: MuskTweetMarketRange): string {
  return range.noTokenId.trim();
}

function yesToken(range: MuskTweetMarketRange): string {
  return range.yesTokenId.trim();
}

function findLowTailRange(ranges: MuskTweetMarketRange[]): MuskTweetMarketRange | undefined {
  return ranges.find((range) => range.minInclusive === 0 && (range.maxInclusive === 39 || range.label.replace(/\s+/g, '') === '<40'));
}

function findRangeOverlapping(ranges: MuskTweetMarketRange[], min: number, max: number): MuskTweetMarketRange | undefined {
  return ranges.find((range) => range.minInclusive <= max && (range.maxInclusive ?? Number.POSITIVE_INFINITY) >= min);
}

function invalidEvaluation(code: MuskTweetInputErrorCode, message: string): MuskTweetEvaluation {
  return { intents: [], rejected: [], checks: [], diagnostics: [message], inputErrorCode: code };
}

function validateEvaluationInput(
  snapshot: MuskTweetSnapshot,
  nowSec: number,
): { code: MuskTweetInputErrorCode; message: string } | null {
  if (!isValidUnixSeconds(nowSec)) {
    return { code: 'INVALID_NOW_SEC', message: 'nowSec must be a finite Unix timestamp representable by JavaScript Date.' };
  }
  return validateSnapshotTimes(snapshot);
}

function validateSnapshotTimes(
  snapshot: MuskTweetSnapshot,
): { code: MuskTweetInputErrorCode; message: string } | null {
  if (!isValidTimestamp(snapshot.capturedAt)) {
    return { code: 'INVALID_SNAPSHOT_CAPTURED_AT', message: 'snapshot.capturedAt must be a valid timestamp.' };
  }
  if (!isValidTimestamp(snapshot.market.startAt)) {
    return { code: 'INVALID_MARKET_START_AT', message: 'snapshot.market.startAt must be a valid timestamp.' };
  }
  if (!isValidTimestamp(snapshot.market.endAt)) {
    return { code: 'INVALID_MARKET_END_AT', message: 'snapshot.market.endAt must be a valid timestamp.' };
  }
  if (!isValidTimestamp(snapshot.counter.updatedAt)) {
    return { code: 'INVALID_COUNTER_UPDATED_AT', message: 'snapshot.counter.updatedAt must be a valid timestamp.' };
  }
  return null;
}

function isValidTimestamp(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function isValidUnixSeconds(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const milliseconds = value * 1_000;
  return Number.isFinite(milliseconds) && Math.abs(milliseconds) <= 8.64e15;
}

function expectedBinaryProfitUsd(amount: number, price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  return amount * ((1 / price) - 1);
}

function hasBurst(snapshot: MuskTweetSnapshot, config: MuskTweetEntryConfig): boolean {
  return snapshot.rates.eventFactor === 'burst'
    || snapshot.rates.rate30m >= config.lotteryBurstRate30m
    || snapshot.rates.rate60m >= config.lotteryBurstRate60m;
}

function adjustedHourlyRate(snapshot: MuskTweetSnapshot): number {
  const base = Math.max(snapshot.rates.rate2h, snapshot.rates.rate6h * 0.75, snapshot.rates.rate24h * 0.35, 0.1);
  if (snapshot.rates.eventFactor === 'burst') return base * 1.35;
  if (snapshot.rates.eventFactor === 'cooldown') return base * 0.6;
  if (snapshot.rates.eventFactor === 'special_event') return base * 1.5;
  return base;
}

function isMainDirectionalRange(range: MuskTweetMarketRange): boolean {
  return (range.minInclusive >= 40 && range.minInclusive <= 89) || (range.maxInclusive != null && range.maxInclusive >= 40 && range.maxInclusive <= 89);
}
