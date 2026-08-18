import { DEFAULT_EV_SNIPE_STRATEGY_CONFIG } from './config';
import { decideEvSnipeEntry } from './decision';
import type {
  EvSnipeDecisionInput,
  EvSnipeFillSimulationInput,
  EvSnipeFillSimulationResult,
  EvSnipeSimulationRowResult,
  EvSnipeSimulationScenario,
} from './types';

const BASE_TIME_MS = 2_000_000_000_000;

function baseInput(): EvSnipeDecisionInput {
  return {
    market: {
      conditionId: 'condition-btc-100k',
      symbol: 'BTCUSDT',
      rule: 'HIT_UP_GTE',
      strikePrice: 100_000,
      yesTokenId: 'yes-btc-100k',
      priceSource: 'binance:BTCUSDT:trade',
      startTimeMs: BASE_TIME_MS - 60_000,
      endTimeMs: BASE_TIME_MS + 24 * 60 * 60 * 1_000,
    },
    tick: {
      symbol: 'BTCUSDT',
      priceSource: 'binance:BTCUSDT:trade',
      previousPrice: 99_999,
      price: 100_000,
      exchangeTimeMs: BASE_TIME_MS,
      receivedTimeMs: BASE_TIME_MS + 50,
    },
    quote: {
      tokenId: 'yes-btc-100k',
      bestAsk: 0.98,
      availableAskNotionalUsd: 100,
      receivedTimeMs: BASE_TIME_MS + 40,
      acceptingOrders: true,
    },
    evaluatedAtMs: BASE_TIME_MS + 100,
  };
}

function scenario(
  id: string,
  category: EvSnipeSimulationScenario['category'],
  description: string,
  mutate: (input: EvSnipeDecisionInput) => void,
  expected: EvSnipeSimulationScenario['expected'],
  fill?: EvSnipeSimulationScenario['fill'],
): EvSnipeSimulationScenario {
  const input = baseInput();
  mutate(input);
  return { id, category, description, input, expected, fill };
}

export function buildEvSnipeSystemSimulationMatrix(): EvSnipeSimulationScenario[] {
  return [
    scenario('confirm-up-exact-boundary', 'TRIGGER', 'Up trigger accepts an exact >= strike crossing.', () => {},
      { decision: 'ELIGIBLE', reasonCode: 'TRIGGER_CONFIRMED', fillStatus: 'FILLED', pnlSign: 'POSITIVE' },
      { executionPrice: 0.98, availableAskNotionalUsd: 100, resolvedWinning: true }),
    scenario('confirm-down-exact-boundary', 'TRIGGER', 'Down trigger accepts an exact <= strike crossing.', (input) => {
      input.market.rule = 'HIT_DOWN_LTE'; input.tick.previousPrice = 100_001; input.tick.price = 100_000;
    }, { decision: 'ELIGIBLE', reasonCode: 'TRIGGER_CONFIRMED' }),
    scenario('no-crossing', 'TRIGGER', 'A tick remaining on the same side waits.', (input) => {
      input.tick.previousPrice = 99_998; input.tick.price = 99_999;
    }, { decision: 'WAIT', reasonCode: 'NO_CROSSING' }),
    scenario('source-mismatch', 'DATA_QUALITY', 'Trigger and resolution-source identities must match.', (input) => {
      input.tick.priceSource = 'other:BTCUSD:trade';
    }, { decision: 'SKIP', reasonCode: 'SOURCE_MISMATCH' }),
    scenario('symbol-mismatch', 'DATA_QUALITY', 'A cross-symbol tick fails closed.', (input) => {
      input.tick.symbol = 'ETHUSDT';
    }, { decision: 'SKIP', reasonCode: 'SYMBOL_MISMATCH' }),
    scenario('stale-trigger', 'DATA_QUALITY', 'A trigger older than the configured latency budget is rejected.', (input) => {
      input.evaluatedAtMs = input.tick.receivedTimeMs + 251;
    }, { decision: 'SKIP', reasonCode: 'STALE_TRIGGER' }),
    scenario('stale-source-transport', 'DATA_QUALITY', 'A delayed exchange event cannot appear fresh merely because it was just received.', (input) => {
      input.tick.receivedTimeMs = input.tick.exchangeTimeMs + 1_201;
      input.evaluatedAtMs = input.tick.receivedTimeMs + 10;
      input.quote.receivedTimeMs = input.evaluatedAtMs - 10;
    }, { decision: 'SKIP', reasonCode: 'STALE_TRIGGER' }),
    scenario('latency-exact-boundaries', 'DATA_QUALITY', 'Source and post-receive latency are inclusive at their configured limits.', (input) => {
      input.tick.receivedTimeMs = input.tick.exchangeTimeMs + 1_200;
      input.evaluatedAtMs = input.tick.receivedTimeMs + 250;
      input.quote.receivedTimeMs = input.evaluatedAtMs;
    }, { decision: 'ELIGIBLE', reasonCode: 'TRIGGER_CONFIRMED' }),
    scenario('stale-quote', 'DATA_QUALITY', 'A stale executable quote is rejected.', (input) => {
      input.quote.receivedTimeMs = input.evaluatedAtMs - 1_001;
    }, { decision: 'SKIP', reasonCode: 'STALE_QUOTE' }),
    scenario('quote-age-exact-boundary', 'DATA_QUALITY', 'Quote age is inclusive at the configured limit.', (input) => {
      input.quote.receivedTimeMs = input.evaluatedAtMs - 1_000;
    }, { decision: 'ELIGIBLE', reasonCode: 'TRIGGER_CONFIRMED' }),
    scenario('after-market-end', 'DATA_QUALITY', 'A trade after the market window cannot authorize entry.', (input) => {
      input.market.endTimeMs = input.tick.exchangeTimeMs - 1;
    }, { decision: 'SKIP', reasonCode: 'MARKET_ENDED' }),
    scenario('price-above-limit', 'ECONOMICS', 'A quote above the configured FAK guard is rejected.', (input) => {
      input.quote.bestAsk = 0.995;
    }, { decision: 'SKIP', reasonCode: 'PRICE_ABOVE_LIMIT' }),
    scenario('price-at-limit', 'ECONOMICS', 'A quote exactly at the configured FAK guard remains eligible when edge passes.', (input) => {
      input.quote.bestAsk = 0.99;
    }, { decision: 'ELIGIBLE', reasonCode: 'TRIGGER_CONFIRMED' }),
    scenario('insufficient-net-edge', 'ECONOMICS', 'Fees and configured edge floor can reject a nominally winning hit.', (input) => {
      input.quote.bestAsk = 0.99; input.config = { minNetEdgeBps: 100 };
    }, { decision: 'SKIP', reasonCode: 'INSUFFICIENT_EDGE' }),
    scenario('fak-partial-fill', 'EXECUTION', 'FAK fills available liquidity and kills the remainder.', () => {},
      { decision: 'ELIGIBLE', reasonCode: 'TRIGGER_CONFIRMED', fillStatus: 'PARTIAL', pnlSign: 'POSITIVE' },
      { executionPrice: 0.98, availableAskNotionalUsd: 4, resolvedWinning: true }),
    scenario('fak-no-fill', 'EXECUTION', 'No executable liquidity produces no position or PnL.', () => {},
      { decision: 'ELIGIBLE', reasonCode: 'TRIGGER_CONFIRMED', fillStatus: 'NO_FILL', pnlSign: 'ZERO' },
      { executionPrice: null, availableAskNotionalUsd: 0, resolvedWinning: null }),
    scenario('resolution-loss-tail', 'ECONOMICS', 'A false confirmation records the full small-win/large-loss asymmetry.', () => {},
      { decision: 'ELIGIBLE', reasonCode: 'TRIGGER_CONFIRMED', fillStatus: 'FILLED', pnlSign: 'NEGATIVE' },
      { executionPrice: 0.98, availableAskNotionalUsd: 100, resolvedWinning: false }),
    scenario('pre-hit-entered-with-probability', 'PRE_HIT', 'Pre-hit needs an explicit probability and positive net edge.', (input) => {
      input.config = { triggerMode: 'PRE_HIT', maxBuyPrice: 0.85 };
      input.tick.previousPrice = 99_980; input.tick.price = 99_995; input.quote.bestAsk = 0.80;
      input.estimatedWinProbability = 0.90;
    }, { decision: 'ELIGIBLE', reasonCode: 'PRE_HIT_ENTERED' }),
    scenario('pre-hit-probability-required', 'PRE_HIT', 'Pre-hit is not treated as certainty when probability is missing.', (input) => {
      input.config = { triggerMode: 'PRE_HIT', maxBuyPrice: 0.85 };
      input.tick.previousPrice = 99_980; input.tick.price = 99_995; input.quote.bestAsk = 0.80;
    }, { decision: 'SKIP', reasonCode: 'PRE_HIT_PROBABILITY_REQUIRED' }),
    scenario('pre-hit-disabled-near-end', 'PRE_HIT', 'Pre-hit fails closed inside the configured cutoff window.', (input) => {
      input.config = { triggerMode: 'PRE_HIT', maxBuyPrice: 0.85 };
      input.market.endTimeMs = input.tick.exchangeTimeMs + DEFAULT_EV_SNIPE_STRATEGY_CONFIG.preHitDisableBeforeEndMs;
      input.tick.previousPrice = 99_980; input.tick.price = 99_995; input.quote.bestAsk = 0.80;
      input.estimatedWinProbability = 0.90;
    }, { decision: 'SKIP', reasonCode: 'PRE_HIT_DISABLED_NEAR_END' }),
  ];
}

export function simulateEvSnipeFill(input: EvSnipeFillSimulationInput): EvSnipeFillSimulationResult {
  const takerFeeRate = input.takerFeeRate ?? DEFAULT_EV_SNIPE_STRATEGY_CONFIG.takerFeeRate;
  const builderFeeRate = input.builderFeeRate ?? DEFAULT_EV_SNIPE_STRATEGY_CONFIG.builderFeeRate;
  if (!Number.isFinite(takerFeeRate) || takerFeeRate < 0 || takerFeeRate > 1
    || !Number.isFinite(builderFeeRate) || builderFeeRate < 0 || builderFeeRate > 1) {
    throw new Error('Invalid EV Snipe fill fee rate.');
  }
  const validExecutionPrice = input.executionPrice !== null
    && Number.isFinite(input.executionPrice)
    && input.executionPrice > 0
    && input.executionPrice <= input.intent.limitPrice;
  const available = Number.isFinite(input.availableAskNotionalUsd)
    ? Math.max(0, input.availableAskNotionalUsd)
    : 0;
  if (!validExecutionPrice || available === 0) {
    return { status: 'NO_FILL', filledNotionalUsd: 0, filledShares: 0, unfilledNotionalUsd: input.intent.requestedNotionalUsd, protocolFeeUsd: 0, builderFeeUsd: 0, payoutUsd: 0, pnlUsd: 0 };
  }
  const executionPrice = input.executionPrice as number;
  const filledNotionalUsd = Math.min(input.intent.requestedNotionalUsd, available);
  const filledShares = filledNotionalUsd / executionPrice;
  const protocolFeeUsd = Math.round(filledShares * takerFeeRate * executionPrice * (1 - executionPrice) * 1e5) / 1e5;
  const builderFeeUsd = filledNotionalUsd * builderFeeRate;
  const payoutUsd = input.resolvedWinning === null ? null : input.resolvedWinning ? filledShares : 0;
  const pnlUsd = payoutUsd === null ? null : payoutUsd - filledNotionalUsd - protocolFeeUsd - builderFeeUsd;
  return {
    status: filledNotionalUsd < input.intent.requestedNotionalUsd ? 'PARTIAL' : 'FILLED',
    filledNotionalUsd,
    filledShares,
    unfilledNotionalUsd: input.intent.requestedNotionalUsd - filledNotionalUsd,
    protocolFeeUsd,
    builderFeeUsd,
    payoutUsd,
    pnlUsd,
  };
}

function pnlSign(pnlUsd: number | null): NonNullable<EvSnipeSimulationScenario['expected']['pnlSign']> {
  if (pnlUsd === null) return 'PENDING';
  if (pnlUsd > 0) return 'POSITIVE';
  if (pnlUsd < 0) return 'NEGATIVE';
  return 'ZERO';
}

export function runEvSnipeSystemSimulationMatrix(
  matrix: readonly EvSnipeSimulationScenario[] = buildEvSnipeSystemSimulationMatrix(),
): EvSnipeSimulationRowResult[] {
  return matrix.map((scenarioRow) => {
    const decision = decideEvSnipeEntry(scenarioRow.input);
    const fill = decision.intent && scenarioRow.fill
      ? simulateEvSnipeFill({ intent: decision.intent, ...scenarioRow.fill })
      : null;
    const mismatches: string[] = [];
    if (decision.decision !== scenarioRow.expected.decision) mismatches.push(`decision:${decision.decision}`);
    if (decision.reasonCode !== scenarioRow.expected.reasonCode) mismatches.push(`reason:${decision.reasonCode}`);
    if (scenarioRow.expected.fillStatus && fill?.status !== scenarioRow.expected.fillStatus) mismatches.push(`fill:${fill?.status ?? 'NONE'}`);
    if (scenarioRow.expected.pnlSign && pnlSign(fill?.pnlUsd ?? null) !== scenarioRow.expected.pnlSign) mismatches.push(`pnl:${pnlSign(fill?.pnlUsd ?? null)}`);
    return { scenarioId: scenarioRow.id, category: scenarioRow.category, decision, fill, passed: mismatches.length === 0, mismatches };
  });
}
