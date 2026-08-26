import { decideCryptoTailEntry } from '../crypto-tail';
import type { CryptoTailDecisionResult } from '../crypto-tail';
import type {
  Btc15mValueSnipeDecisionInput,
  Btc15mValueSnipeDecisionResult,
  Btc15mValueSnipeReasonCode,
} from './types';

function result(
  input: Btc15mValueSnipeDecisionInput | null | undefined,
  base: CryptoTailDecisionResult,
  overrides: Partial<Btc15mValueSnipeDecisionResult> = {},
): Btc15mValueSnipeDecisionResult {
  return {
    ...base,
    venue: input?.venue ?? null,
    reasonCode: base.reasonCode as Btc15mValueSnipeReasonCode,
    estimatedAllInCost: base.estimatedAllInCost,
    edge: base.edge,
    edgeBps: base.edge == null ? null : base.edge * 10_000,
    underlyingReasonCode: base.reasonCode,
    ...overrides,
  };
}

function expectedPriceModel(input: Btc15mValueSnipeDecisionInput): 'chainlink' | 'binance' {
  return input.venue === 'PREDICT_FUN' ? 'binance' : 'chainlink';
}

/**
 * Evaluates a recurring BTC 15m value entry without I/O or order submission.
 * The host owns the exact venue fee/slippage calculation and must pass its
 * effective per-share all-in cost explicitly.
 */
export function decideBtc15mValueSnipeEntry(
  input: Btc15mValueSnipeDecisionInput,
): Btc15mValueSnipeDecisionResult {
  const snapshot = input?.snapshot;
  const fallback = snapshot ? decideCryptoTailEntry({
    ...snapshot,
    config: {
      ...snapshot.config,
      entry: { ...snapshot.config.entry, edgeGateEnabled: false },
    },
  }) : {
    decision: 'SKIP',
    reasonCode: 'INVALID_INPUT',
    reasonMessage: 'Value Snipe input is missing.',
    candidateOutcome: null,
    selectedTokenId: null,
    secondsToEnd: null,
    distanceBps: null,
    estimatedWinProbability: null,
    estimatedAllInCost: null,
    edge: null,
    notionalUsd: null,
    limitPrice: null,
  } satisfies CryptoTailDecisionResult;

  if (!snapshot || (input?.venue !== 'POLYMARKET' && input?.venue !== 'PREDICT_FUN')) {
    return result(input, fallback, { decision: 'SKIP', reasonCode: 'INVALID_INPUT', reasonMessage: 'Venue and normalized snapshot are required.' });
  }
  const priceModel = snapshot.round?.resolutionPriceModel?.kind ?? snapshot.chainlink.priceModel?.kind ?? null;
  const expected = expectedPriceModel(input);
  if ((expected === 'binance' && priceModel !== 'binance')
    || (expected === 'chainlink' && !String(priceModel).startsWith('chainlink-'))) {
    return result(input, fallback, {
      decision: 'SKIP',
      reasonCode: 'VENUE_PRICE_MODEL_MISMATCH',
      reasonMessage: `${input.venue} requires a ${expected} BTC price model.`,
      estimatedAllInCost: null,
      edge: null,
      edgeBps: null,
    });
  }
  if (!Number.isFinite(input.estimatedAllInCost)
    || input.estimatedAllInCost <= 0
    || input.estimatedAllInCost >= 1
    || (fallback.limitPrice != null && input.estimatedAllInCost < fallback.limitPrice)) {
    return result(input, fallback, {
      decision: 'SKIP',
      reasonCode: 'ALL_IN_COST_INVALID',
      reasonMessage: 'Effective venue all-in cost must be finite, below 1.00, and no lower than the entry limit price.',
      estimatedAllInCost: null,
      edge: null,
      edgeBps: null,
    });
  }
  if (fallback.decision !== 'ELIGIBLE' || fallback.estimatedWinProbability == null) {
    return result(input, fallback, { estimatedAllInCost: null, edge: null, edgeBps: null });
  }
  const edge = fallback.estimatedWinProbability - input.estimatedAllInCost;
  const edgeBps = edge * 10_000;
  if (!Number.isFinite(input.config?.minEdgeBps)) {
    return result(input, fallback, { decision: 'SKIP', reasonCode: 'INVALID_INPUT', reasonMessage: 'minEdgeBps must be finite.', estimatedAllInCost: null, edge: null, edgeBps: null });
  }
  if (edgeBps < input.config.minEdgeBps) {
    return result(input, fallback, {
      decision: 'WAIT',
      reasonCode: 'VALUE_EDGE_TOO_SMALL',
      reasonMessage: `Estimated edge ${edgeBps.toFixed(0)} bps is below the configured minimum of ${input.config.minEdgeBps.toFixed(0)} bps.`,
      estimatedAllInCost: input.estimatedAllInCost,
      edge,
      edgeBps,
    });
  }
  return result(input, fallback, {
    reasonMessage: 'Recurring BTC 15m market and venue-specific value edge gates passed.',
    estimatedAllInCost: input.estimatedAllInCost,
    edge,
    edgeBps,
  });
}
