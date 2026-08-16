import type { Btc15mDecisionInput, Btc15mDecisionResult, Btc15mGateDiagnostic } from './types';

function skip(reasonCode: string, reasonMessage: string, extras: Partial<Btc15mDecisionResult> = {}): Btc15mDecisionResult {
  return {
    decision: 'SKIP',
    reasonCode,
    reasonMessage,
    candidateOutcome: null,
    selectedTokenId: null,
    secondsToEnd: null,
    distanceBps: null,
    estimatedWinProbability: null,
    estimatedAllInCost: null,
    edge: null,
    notionalUsd: null,
    limitPrice: null,
    ...extras,
  };
}

function wait(reasonCode: string, reasonMessage: string, extras: Partial<Btc15mDecisionResult> = {}): Btc15mDecisionResult {
  return {
    ...skip(reasonCode, reasonMessage, extras),
    decision: 'WAIT',
  };
}

export function estimateBtc15mAllInCost(ask: number): number {
  return ask + 0.07 * ask * (1 - ask);
}

// Entry limit price with an optional marketable offset. A passive limit placed at
// the snapshot best ask misses fills when the ask ticks up during the place->CLOB
// latency window (and is then adversely selected — it only fills when flow turns
// against the position). Lifting the limit by `offsetTicks` keeps it marketable
// through that drift. offsetTicks=0 (default) or an unknown tick size returns the
// raw best ask, so existing tasks are byte-for-byte unchanged. The result is
// snapped to the tick grid and never allowed above askCap.
export function resolveBtc15mEntryLimitPrice(params: {
  bestAsk: number;
  offsetTicks: number;
  tickSize: number | null;
  askCap: number;
}): number {
  const { bestAsk, offsetTicks, tickSize, askCap } = params;
  if (!(offsetTicks > 0) || tickSize == null || !(tickSize > 0)) return bestAsk;
  const raw = Math.min(bestAsk + offsetTicks * tickSize, askCap);
  const snapped = Number((Math.round(raw / tickSize) * tickSize).toFixed(6));
  return Math.min(snapped, askCap);
}

const MAX_TIME_COMPONENT = 0.05;

// Legacy seconds-to-end ladder, used when settlement is a single instant
// (spot / binance candle close) rather than a trailing average.
function legacyTimeComponent(secondsToEnd: number): number {
  return secondsToEnd <= 12
    ? 0.05
    : secondsToEnd <= 15
      ? 0.04
      : secondsToEnd <= 30
        ? 0.025
        : secondsToEnd <= 45
          ? 0.012
          : 0;
}

// Under Chainlink TWAP resolution the settlement price is the average over the
// last `windowSeconds` of the round, so what actually locks in the current lead
// is how much of that settlement window has already elapsed at decision time —
// not the raw seconds to end. This fraction is also exactly the overlap between
// the live TWAP snapshot we observe and the settlement window, so it is the
// honest measure of how much of the outcome is already determined.
function twapTimeComponent(secondsToEnd: number, windowSeconds: number): number {
  const lockedFraction = Math.min(1, Math.max(0, 1 - secondsToEnd / windowSeconds));
  return MAX_TIME_COMPONENT * lockedFraction;
}

// Consistency gate. The entry signal is the trailing TWAP lead (twapPrice vs round
// start), which lags live price. `spotPrice` is the live Chainlink spot from the
// same RTDS feed. When live spot has already diverged past the TWAP in the
// opposite direction of the lead, the lead is reversing and a cheap CLOB ask is
// the market correctly pricing that reversal — not a lag to exploit (see the
// 2026-08-13 findings in docs/plans/btc-15m-auto-trade-strategy-assessment.md).
// Returns true when spot opposes the lead by at least `minContradictionBps`.
export function btc15mSpotContradictsSignal(params: {
  startPrice: number;
  twapPrice: number;
  spotPrice: number | null;
  minContradictionBps: number;
}): boolean {
  const { startPrice, twapPrice, spotPrice, minContradictionBps } = params;
  if (spotPrice == null || !(startPrice > 0)) return false;
  const leadDelta = twapPrice - startPrice;          // side the strategy is betting
  const spotDivergence = spotPrice - twapPrice;      // how far live has moved past the lagging TWAP
  const divergenceBps = Math.abs(spotDivergence) / startPrice * 10_000;
  if (divergenceBps < minContradictionBps) return false;
  const leadUp = leadDelta >= 0;
  const spotAboveTwap = spotDivergence > 0;
  return leadUp !== spotAboveTwap;
}

export function estimateBtc15mWinProbability(params: {
  distanceBps: number;
  requiredDistanceBps: number;
  secondsToEnd: number;
  windowSeconds?: number | null;
}): number {
  const distanceExcess = Math.max(0, params.distanceBps - params.requiredDistanceBps);
  const distanceComponent = Math.min(0.08, distanceExcess / 500);
  const timeComponent = params.windowSeconds != null && params.windowSeconds > 0
    ? twapTimeComponent(params.secondsToEnd, params.windowSeconds)
    : legacyTimeComponent(params.secondsToEnd);
  return Math.min(0.99, 0.90 + distanceComponent + timeComponent);
}

// Derives the settlement TWAP window (in seconds) from a resolution price model,
// or null when settlement is spot-like and the legacy time ladder should apply.
export function twapWindowSeconds(model: { kind: string; windowSeconds: number | null } | null | undefined): number | null {
  return model?.kind === 'chainlink-twap' ? model.windowSeconds : null;
}

export function requiredBtc15mDistanceBps(input: Btc15mDecisionInput, secondsToEnd: number): number | null {
  const sorted = [...input.config.entry.entryWindows].sort((left, right) => right.secondsToEndMin - left.secondsToEndMin);
  for (const window of sorted) {
    if (secondsToEnd >= window.secondsToEndMin) return window.minDistanceBps;
  }
  return null;
}

function gate(
  key: string,
  label: string,
  status: Btc15mGateDiagnostic['status'],
  expected: string,
  actual: string,
): Btc15mGateDiagnostic {
  return { key, label, status, expected, actual };
}

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no';
}

function fmt(value: number | null | undefined, digits = 3): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : 'missing';
}

/** Builds an explanatory gate snapshot; the decision function remains authoritative. */
export function buildBtc15mGateDiagnostics(input: Btc15mDecisionInput): Btc15mGateDiagnostic[] {
  const strategyLabel = input.strategyLabel ?? 'BTC 15m';
  const settlementPairLabel = input.settlementPairLabel ?? 'BTC/USD';
  const diagnostics: Btc15mGateDiagnostic[] = [
    gate(
      'live_gate',
      'Live mode allowed',
      input.global.liveTradingEnabled ? 'pass' : 'fail',
      'backend live trading enabled',
      `live config ${yesNo(input.global.liveTradingEnabled)}`,
    ),
  ];

  if (!input.round) {
    diagnostics.push(gate('round_available', 'Current round resolved', 'pending', `active ${strategyLabel} Polymarket round`, 'round metadata unavailable'));
    return diagnostics;
  }

  const secondsToEnd = input.round.roundEndSec - input.nowSec;
  const minLiquidity = input.config.entry.minLiquidityClob;
  diagnostics.push(
    gate('round_available', 'Current round resolved', 'pass', `active ${strategyLabel} Polymarket round`, input.round.roundKey),
    gate('round_metadata_fresh', 'Round metadata fresh', input.round.metadataFresh ? 'pass' : 'fail', 'fresh market metadata', yesNo(input.round.metadataFresh)),
    gate('settlement_source', `${settlementPairLabel} settlement source`, input.round.settlementSourceOk ? 'pass' : 'fail', `settlement metadata confirms ${settlementPairLabel}`, yesNo(input.round.settlementSourceOk)),
    gate('market_active', 'Market active', input.round.active && !input.round.closed ? 'pass' : 'fail', 'active and not closed', `active ${yesNo(input.round.active)}, closed ${yesNo(input.round.closed)}`),
    gate('accepting_orders', 'Accepting orders', input.round.acceptingOrders ? 'pass' : 'fail', 'market accepts orders', yesNo(input.round.acceptingOrders)),
    gate('orderbook_enabled', 'Orderbook enabled', input.round.enableOrderBook ? 'pass' : 'fail', 'market orderbook enabled', yesNo(input.round.enableOrderBook)),
    gate(
      'order_min_size',
      'Min order size',
      input.round.orderMinSize != null ? 'pass' : 'pending',
      'market minimum shares available',
      input.round.orderMinSize == null ? 'unknown' : `${fmt(input.round.orderMinSize, 2)} shares`,
    ),
    gate(
      'round_liquidity',
      'CLOB liquidity',
      input.round.liquidityClob != null && input.round.liquidityClob >= minLiquidity ? 'pass' : 'fail',
      `>= $${fmt(minLiquidity, 0)}`,
      input.round.liquidityClob == null ? 'missing' : `$${fmt(input.round.liquidityClob, 0)}`,
    ),
    gate(
      'entry_window',
      'Entry time window',
      secondsToEnd > input.config.entry.entryWindowStartSeconds ? 'pending' : secondsToEnd >= input.config.entry.entryWindowEndSeconds ? 'pass' : 'fail',
      `T-${input.config.entry.entryWindowStartSeconds}s through T-${input.config.entry.entryWindowEndSeconds}s`,
      `${secondsToEnd}s left`,
    ),
  );

  const hasChainlinkPrices = Boolean(input.chainlink.startPrice && input.chainlink.currentPrice && input.chainlink.currentPointTs);
  diagnostics.push(
    gate('chainlink_prices', 'Reference prices available', hasChainlinkPrices ? 'pass' : 'fail', 'start and current price present', `P0 ${fmt(input.chainlink.startPrice, 2)}, current ${fmt(input.chainlink.currentPrice, 2)}`),
    gate('chainlink_fresh', 'Reference price fresh', input.chainlink.fresh ? 'pass' : 'fail', 'latest point within freshness window', yesNo(input.chainlink.fresh)),
  );

  const delta = input.chainlink.startPrice && input.chainlink.currentPrice
    ? input.chainlink.currentPrice - input.chainlink.startPrice
    : null;
  const distanceBps = delta != null && input.chainlink.startPrice
    ? Math.abs(delta) / input.chainlink.startPrice * 10_000
    : null;
  const absoluteDistanceUsd = delta == null ? null : Math.abs(delta);
  const candidateOutcome = delta == null ? null : delta >= 0 ? 'Up' : 'Down';
  const selectedTokenId = candidateOutcome === 'Up'
    ? input.round.upTokenId
    : candidateOutcome === 'Down'
      ? input.round.downTokenId
      : null;
  const requiredDistance = requiredBtc15mDistanceBps(input, secondsToEnd);
  const consistencyContradiction = input.config.entry.consistencyGateEnabled
    && input.chainlink.startPrice != null
    && input.chainlink.currentPrice != null
    && input.chainlink.spotPrice != null
    ? btc15mSpotContradictsSignal({
        startPrice: input.chainlink.startPrice,
        twapPrice: input.chainlink.currentPrice,
        spotPrice: input.chainlink.spotPrice,
        minContradictionBps: input.config.entry.consistencyMinContradictionBps,
      })
    : null;
  diagnostics.push(
    gate('outcome_token', 'Outcome token available', selectedTokenId ? 'pass' : 'fail', 'token id for current direction', candidateOutcome ? `${candidateOutcome}: ${selectedTokenId ?? 'missing'}` : 'direction unavailable'),
    gate(
      'distance_threshold',
      'Signal distance',
      requiredDistance == null || distanceBps == null
        ? 'pending'
        : distanceBps >= requiredDistance ? 'pass' : 'fail',
      requiredDistance == null ? 'configured entry-window threshold' : `>= ${fmt(requiredDistance, 2)} bps`,
      distanceBps == null ? 'missing' : `${fmt(distanceBps, 2)} bps`,
    ),
    gate(
      'distance_entry_gate',
      'Entry distance gate',
      !input.config.entry.distanceGateEnabled ? 'pass' : distanceBps != null && distanceBps / 100 >= input.config.entry.minDistancePercent ? 'pass' : distanceBps == null ? 'pending' : 'fail',
      input.config.entry.distanceGateEnabled ? `>= ${fmt(input.config.entry.minDistancePercent, 3)}%` : 'disabled',
      distanceBps == null ? 'missing' : `${fmt(distanceBps / 100, 3)}%`,
    ),
    gate(
      'absolute_distance_entry_gate',
      'Absolute entry distance gate',
      !input.config.entry.absoluteDistanceGateEnabled
        ? 'pass'
        : absoluteDistanceUsd != null && absoluteDistanceUsd >= input.config.entry.minAbsoluteDistanceUsd
          ? 'pass'
          : absoluteDistanceUsd == null ? 'pending' : 'fail',
      input.config.entry.absoluteDistanceGateEnabled ? `>= $${fmt(input.config.entry.minAbsoluteDistanceUsd, 2)}` : 'disabled',
      absoluteDistanceUsd == null ? 'missing' : `$${fmt(absoluteDistanceUsd, 2)}`,
    ),
    gate(
      'signal_consistency',
      'Signal consistency',
      !input.config.entry.consistencyGateEnabled
        ? 'pass'
        : consistencyContradiction == null
          ? 'pending'
          : consistencyContradiction ? 'fail' : 'pass',
      input.config.entry.consistencyGateEnabled
        ? `spot not reversing lead by >= ${fmt(input.config.entry.consistencyMinContradictionBps, 2)} bps`
        : 'disabled',
      input.chainlink.spotPrice == null ? 'no spot point' : `spot ${fmt(input.chainlink.spotPrice, 2)}`,
    ),
  );

  const bestAsk = input.orderbook.bestAsk;
  diagnostics.push(
    gate('orderbook_ask', 'Best ask available', bestAsk != null ? 'pass' : 'fail', 'best ask present', fmt(bestAsk)),
    gate('orderbook_fresh', 'Orderbook fresh', input.orderbook.fresh ? 'pass' : 'fail', 'fresh orderbook snapshot', yesNo(input.orderbook.fresh)),
    gate('ask_below_one', 'Ask below 1.00', bestAsk != null && bestAsk < 1 ? 'pass' : 'fail', '< 1.000', fmt(bestAsk)),
    gate('entry_price_floor', 'Entry price floor', bestAsk != null && bestAsk > input.config.entry.minEntryAsk ? 'pass' : 'fail', `> ${fmt(input.config.entry.minEntryAsk)}`, fmt(bestAsk)),
    gate('entry_price_cap', 'Entry price cap', bestAsk != null && bestAsk <= input.config.entry.askCap ? 'pass' : 'fail', `<= ${fmt(input.config.entry.askCap)}`, fmt(bestAsk)),
    gate('spread_available', 'Spread available', input.orderbook.spread != null ? 'pass' : 'fail', 'spread present', fmt(input.orderbook.spread)),
    gate('spread_hard_cap', 'Spread hard cap', input.orderbook.spread != null && input.orderbook.spread <= input.config.entry.maxSpreadHard ? 'pass' : 'fail', `<= ${fmt(input.config.entry.maxSpreadHard)}`, fmt(input.orderbook.spread)),
    gate('spread_target', 'Spread target', input.orderbook.spread != null && input.orderbook.spread <= input.config.entry.maxSpread ? 'pass' : 'fail', `<= ${fmt(input.config.entry.maxSpread)}`, fmt(input.orderbook.spread)),
    gate('round_duplicate', 'No round duplicate', !input.risk.hasRoundExecution ? 'pass' : 'fail', 'no existing live order this round', input.risk.hasRoundExecution ? 'already executed' : 'clear'),
    gate('daily_loss_stop', 'Strategy daily loss stop clear', input.risk.dailyLossUsd < input.config.risk.dailyLossStopUsd ? 'pass' : 'fail', `< $${fmt(input.config.risk.dailyLossStopUsd, 2)}`, `$${fmt(input.risk.dailyLossUsd, 2)}`),
    gate(
      'task_net_loss_stop',
      'Strategy task loss stop clear',
      input.config.risk.maxTaskNetLossUsd == null || input.risk.taskNetLossUsd < input.config.risk.maxTaskNetLossUsd ? 'pass' : 'fail',
      input.config.risk.maxTaskNetLossUsd == null ? 'not set' : `< $${fmt(input.config.risk.maxTaskNetLossUsd, 2)}`,
      `$${fmt(input.risk.taskNetLossUsd, 2)}`,
    ),
    gate('loss_streak_stop', 'Strategy loss streak stop clear', input.risk.consecutiveLosses < input.config.risk.consecutiveLossStop ? 'pass' : 'fail', `< ${input.config.risk.consecutiveLossStop}`, String(input.risk.consecutiveLosses)),
    gate('daily_trade_limit', 'Daily trade limit clear', input.risk.tradesToday < input.config.risk.maxTradesPerDay ? 'pass' : 'fail', `< ${input.config.risk.maxTradesPerDay}`, String(input.risk.tradesToday)),
  );

  const notionalUsd = input.global.maxNotionalUsd == null
    ? input.config.entry.maxNotionalUsd
    : Math.min(input.config.entry.maxNotionalUsd, input.global.maxNotionalUsd);
  const requiredDepthUsd = notionalUsd * input.config.entry.depthMultiplier;
  diagnostics.push(gate(
    'orderbook_depth',
    'Top ask depth',
    input.orderbook.topDepthUsd != null && input.orderbook.topDepthUsd >= requiredDepthUsd ? 'pass' : 'fail',
    `>= $${fmt(requiredDepthUsd, 2)}`,
    input.orderbook.topDepthUsd == null ? 'missing' : `$${fmt(input.orderbook.topDepthUsd, 2)}`,
  ));

  const canEstimateEdge = bestAsk != null && distanceBps != null;
  const estimatedAllInCost = bestAsk != null ? estimateBtc15mAllInCost(bestAsk) : null;
  const estimatedWinProbability = canEstimateEdge
    ? estimateBtc15mWinProbability({ distanceBps, requiredDistanceBps: requiredDistance ?? 0, secondsToEnd, windowSeconds: twapWindowSeconds(input.round.resolutionPriceModel) })
    : null;
  const edge = estimatedWinProbability != null && estimatedAllInCost != null
    ? estimatedWinProbability - estimatedAllInCost
    : null;
  diagnostics.push(gate(
    'estimated_edge',
    'Estimated edge',
    edge == null
      ? 'pending'
      : !input.config.entry.edgeGateEnabled || edge * 10_000 >= input.config.entry.minEdgeBps
        ? 'pass'
        : 'fail',
    input.config.entry.edgeGateEnabled ? `>= ${fmt(input.config.entry.minEdgeBps, 0)} bps` : 'disabled',
    edge == null ? 'missing' : `${fmt(edge * 100, 2)}%`,
  ));

  return diagnostics;
}

/**
 * Evaluates one immutable normalized snapshot and returns a deterministic entry decision.
 * This function performs no I/O and never submits an order.
 */
export function decideBtc15mTailEntry(input: Btc15mDecisionInput): Btc15mDecisionResult {
  const strategyLabel = input.strategyLabel ?? 'BTC 15m';
  const settlementPairLabel = input.settlementPairLabel ?? 'BTC/USD';
  if (!input.round) {
    return wait('ROUND_UNAVAILABLE', `${strategyLabel} round is not available yet.`);
  }
  if (!input.round.metadataFresh) {
    return wait('ROUND_METADATA_STALE', `${strategyLabel} round metadata is not fresh enough.`);
  }
  if (!input.round.settlementSourceOk) {
    return skip('SETTLEMENT_SOURCE_UNCONFIRMED', `Round metadata does not confirm ${settlementPairLabel} settlement.`);
  }
  if (!input.round.active || input.round.closed) {
    return skip('MARKET_NOT_ACTIVE', 'Market is not active for trading.');
  }
  if (!input.round.acceptingOrders) {
    return skip('MARKET_NOT_ACCEPTING_ORDERS', 'Market is not accepting orders.');
  }
  if (!input.round.enableOrderBook) {
    return skip('ORDERBOOK_DISABLED', 'Market orderbook is disabled.');
  }
  if (input.round.liquidityClob == null || input.round.liquidityClob < input.config.entry.minLiquidityClob) {
    return skip('LIQUIDITY_TOO_LOW', 'Market CLOB liquidity is below the strategy minimum.');
  }

  const secondsToEnd = input.round.roundEndSec - input.nowSec;
  if (secondsToEnd > input.config.entry.entryWindowStartSeconds) {
    return wait('BEFORE_DECISION_WINDOW', `Waiting for the T-${input.config.entry.entryWindowStartSeconds}s decision window.`, { secondsToEnd });
  }
  if (secondsToEnd < input.config.entry.entryWindowEndSeconds) {
    return skip('AFTER_ENTRY_WINDOW', `No new entries after T-${input.config.entry.entryWindowEndSeconds}s.`, { secondsToEnd });
  }

  if (!input.chainlink.startPrice || !input.chainlink.currentPrice || !input.chainlink.currentPointTs) {
    return skip('CHAINLINK_PRICE_MISSING', 'Missing reference start or current price.', { secondsToEnd });
  }
  if (!input.chainlink.fresh) {
    return skip('CHAINLINK_STALE', 'Latest reference price is stale.', { secondsToEnd });
  }

  const delta = input.chainlink.currentPrice - input.chainlink.startPrice;
  const distanceBps = Math.abs(delta) / input.chainlink.startPrice * 10_000;
  const absoluteDistanceUsd = Math.abs(delta);
  const candidateOutcome = delta >= 0 ? 'Up' : 'Down';
  const selectedTokenId = candidateOutcome === 'Up' ? input.round.upTokenId : input.round.downTokenId;
  const requiredDistance = requiredBtc15mDistanceBps(input, secondsToEnd);
  const distancePercent = distanceBps / 100;

  if (!selectedTokenId) {
    return skip('TOKEN_UNAVAILABLE', `Missing ${candidateOutcome} token id.`, { secondsToEnd, distanceBps, candidateOutcome });
  }
  if (requiredDistance == null) {
    return skip('NO_THRESHOLD_FOR_WINDOW', 'No configured distance threshold covers the current entry window.', {
      secondsToEnd,
      distanceBps,
      candidateOutcome,
      selectedTokenId,
    });
  }
  if (distanceBps < requiredDistance) {
    return wait('DISTANCE_TOO_SMALL', `Signal distance ${distanceBps.toFixed(2)} bps is below the entry-window threshold of ${requiredDistance.toFixed(2)} bps.`, {
      secondsToEnd,
      distanceBps,
      candidateOutcome,
      selectedTokenId,
    });
  }
  if (input.config.entry.distanceGateEnabled && distancePercent < input.config.entry.minDistancePercent) {
    return wait('DISTANCE_GATE_TOO_LOW', `Signal distance ${distancePercent.toFixed(3)}% is below entry gate ${input.config.entry.minDistancePercent.toFixed(3)}%.`, {
      secondsToEnd,
      distanceBps,
      candidateOutcome,
      selectedTokenId,
    });
  }
  if (input.config.entry.absoluteDistanceGateEnabled && absoluteDistanceUsd < input.config.entry.minAbsoluteDistanceUsd) {
    return wait('ABSOLUTE_DISTANCE_TOO_LOW', `Absolute price distance $${absoluteDistanceUsd.toFixed(2)} is below entry gate $${input.config.entry.minAbsoluteDistanceUsd.toFixed(2)}.`, {
      secondsToEnd,
      distanceBps,
      candidateOutcome,
      selectedTokenId,
    });
  }
  if (input.config.entry.consistencyGateEnabled && btc15mSpotContradictsSignal({
    startPrice: input.chainlink.startPrice,
    twapPrice: input.chainlink.currentPrice,
    spotPrice: input.chainlink.spotPrice ?? null,
    minContradictionBps: input.config.entry.consistencyMinContradictionBps,
  })) {
    return wait(
      'SIGNAL_MOMENTUM_CONTRADICTION',
      `Live spot is reversing the ${candidateOutcome} signal lead; skipping the entry.`,
      { secondsToEnd, distanceBps, candidateOutcome, selectedTokenId },
    );
  }
  const bestAsk = input.orderbook.bestAsk;
  if (bestAsk == null) {
    return skip('ORDERBOOK_ASK_MISSING', 'Best ask is unavailable.', { secondsToEnd, distanceBps, candidateOutcome, selectedTokenId });
  }
  if (!input.orderbook.fresh) {
    return skip('ORDERBOOK_STALE', 'Orderbook snapshot is stale.', { secondsToEnd, distanceBps, candidateOutcome, selectedTokenId });
  }
  if (bestAsk >= 1) {
    return skip('ASK_ONE_DOLLAR', 'Never buy at 1.00.', { secondsToEnd, distanceBps, candidateOutcome, selectedTokenId });
  }
  if (bestAsk <= input.config.entry.minEntryAsk) {
    return wait('ASK_BELOW_ENTRY_FLOOR', `Best ask ${bestAsk.toFixed(3)} is not above entry floor ${input.config.entry.minEntryAsk.toFixed(3)}.`, {
      secondsToEnd,
      distanceBps,
      candidateOutcome,
      selectedTokenId,
    });
  }
  if (bestAsk > input.config.entry.askCap) {
    return wait('ASK_ABOVE_ENTRY_CAP', `Best ask ${bestAsk.toFixed(3)} is above entry cap ${input.config.entry.askCap.toFixed(3)}.`, {
      secondsToEnd,
      distanceBps,
      candidateOutcome,
      selectedTokenId,
    });
  }

  if (input.orderbook.spread == null) {
    return skip('SPREAD_UNAVAILABLE', 'Orderbook spread is unavailable.', { secondsToEnd, distanceBps, candidateOutcome, selectedTokenId });
  }
  if (input.orderbook.spread > input.config.entry.maxSpreadHard) {
    return skip('SPREAD_TOO_WIDE', 'Spread is above the hard cap.', { secondsToEnd, distanceBps, candidateOutcome, selectedTokenId });
  }
  if (input.orderbook.spread > input.config.entry.maxSpread) {
    return skip('SPREAD_ABOVE_TARGET', 'Spread is above the strategy target.', { secondsToEnd, distanceBps, candidateOutcome, selectedTokenId });
  }

  if (input.risk.hasRoundExecution) {
    return skip('ROUND_ALREADY_EXECUTED', 'This strategy already has a live execution for the round.', { secondsToEnd, distanceBps, candidateOutcome, selectedTokenId });
  }
  if (input.config.risk.maxTaskNetLossUsd != null && input.risk.taskNetLossUsd >= input.config.risk.maxTaskNetLossUsd) {
    return skip('TASK_NET_LOSS_STOP', 'Task net loss stop is active.', { secondsToEnd, distanceBps, candidateOutcome, selectedTokenId });
  }
  if (input.risk.consecutiveLosses >= input.config.risk.consecutiveLossStop) {
    return skip('CONSECUTIVE_LOSS_STOP', 'Consecutive loss stop is active.', { secondsToEnd, distanceBps, candidateOutcome, selectedTokenId });
  }
  if (input.risk.dailyLossUsd >= input.config.risk.dailyLossStopUsd) {
    return skip('DAILY_LOSS_STOP', 'Daily realized net loss stop is active until the next UTC day.', { secondsToEnd, distanceBps, candidateOutcome, selectedTokenId });
  }
  if (input.risk.tradesToday >= input.config.risk.maxTradesPerDay) {
    return skip('DAILY_TRADE_LIMIT', 'Daily trade limit reached.', { secondsToEnd, distanceBps, candidateOutcome, selectedTokenId });
  }

  const estimatedAllInCost = estimateBtc15mAllInCost(bestAsk);
  const notionalUsd = input.global.maxNotionalUsd == null
    ? input.config.entry.maxNotionalUsd
    : Math.min(input.config.entry.maxNotionalUsd, input.global.maxNotionalUsd);
  const limitOrderShares = Math.ceil(notionalUsd / bestAsk * 100) / 100;
  if (input.round.orderMinSize != null && limitOrderShares < input.round.orderMinSize) {
    return skip(
      'LIMIT_ORDER_SIZE_BELOW_MARKET_MINIMUM',
      `Limit order size ${limitOrderShares} shares is below the market minimum of ${input.round.orderMinSize} shares.`,
      {
      secondsToEnd,
      distanceBps,
      candidateOutcome,
      selectedTokenId,
      notionalUsd,
      limitPrice: bestAsk,
      },
    );
  }
  const requiredDepthUsd = notionalUsd * input.config.entry.depthMultiplier;
  if (input.orderbook.topDepthUsd == null || input.orderbook.topDepthUsd < requiredDepthUsd) {
    return skip('ORDERBOOK_DEPTH_TOO_THIN', 'Top-three ask depth is below the strategy multiplier.', {
      secondsToEnd,
      distanceBps,
      candidateOutcome,
      selectedTokenId,
      notionalUsd,
      estimatedAllInCost,
    });
  }
  const estimatedWinProbability = estimateBtc15mWinProbability({
    distanceBps,
    requiredDistanceBps: requiredDistance,
    secondsToEnd,
    windowSeconds: twapWindowSeconds(input.round.resolutionPriceModel),
  });
  const edge = estimatedWinProbability - estimatedAllInCost;
  const edgeBps = edge * 10_000;
  if (input.config.entry.edgeGateEnabled && edgeBps < input.config.entry.minEdgeBps) {
    return wait(
      'EDGE_TOO_SMALL',
      `Estimated edge ${edgeBps.toFixed(0)} bps is below the configured minimum of ${input.config.entry.minEdgeBps.toFixed(0)} bps.`,
      {
        secondsToEnd,
        distanceBps,
        candidateOutcome,
        selectedTokenId,
        estimatedWinProbability,
        estimatedAllInCost,
        edge,
        notionalUsd,
        limitPrice: bestAsk,
      },
    );
  }

  const limitPrice = resolveBtc15mEntryLimitPrice({
    bestAsk,
    offsetTicks: input.config.entry.entryAskOffsetTicks,
    tickSize: input.orderbook.tickSize ?? null,
    askCap: input.config.entry.askCap,
  });

  return {
    decision: 'ELIGIBLE',
    reasonCode: 'ENTRY_READY',
    reasonMessage: 'Entry gates passed.',
    candidateOutcome,
    selectedTokenId,
    secondsToEnd,
    distanceBps,
    estimatedWinProbability,
    estimatedAllInCost,
    edge,
    notionalUsd,
    limitPrice,
  };
}

// Asset-agnostic public names. Keep the original exports so Polybot can switch
// package boundaries without changing decision behavior in the same release.
export const decideCryptoTailEntry = decideBtc15mTailEntry;
export const buildCryptoTailGateDiagnostics = buildBtc15mGateDiagnostics;
export const estimateCryptoTailAllInCost = estimateBtc15mAllInCost;
export const estimateCryptoTailWinProbability = estimateBtc15mWinProbability;
