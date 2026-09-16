import type { CryptoTailOracleState } from './types';

export type CryptoTailExitPolicy = {
  directionFlipEnabled: boolean;
  distanceCollapsePercent: number | null;
  // See Btc15mEntryConfig.ofiReversalStopEnabled. When true, the evaluator checks
  // `ofiSignal` (below) ahead of any oracle-dependent check, since the signal is
  // independent of Chainlink freshness by design. Optional and defaults to false so
  // existing callers built before this field existed keep compiling and behaving
  // exactly as before.
  ofiReversalEnabled?: boolean;
};

export type CryptoTailPositionSignal = {
  outcome: 'Up' | 'Down' | null;
  entryDistanceBps: number | null;
};

/**
 * A point-in-time read of an external, host-computed order-flow-imbalance signal.
 * `favoredOutcome` is the side the signal currently favors (or null when the host has
 * no confident read yet, e.g. not enough data or below its trigger threshold) — the
 * evaluator never computes this itself, it only compares it against the held position.
 */
export type CryptoTailOfiSignal = {
  favoredOutcome: 'Up' | 'Down' | null;
};

export type CryptoTailExitDecision = {
  shouldExit: boolean;
  reasonCode:
    | 'ROUND_ENDED'
    | 'OFI_REVERSAL'
    | 'CHAINLINK_UNAVAILABLE'
    | 'DIRECTION_FLIPPED'
    | 'DISTANCE_COLLAPSED'
    | 'POSITION_HELD';
  reasonMessage: string;
  distanceBps: number | null;
  currentDelta: number | null;
  secondsToEnd: number;
};

/** Evaluates reference-price exit signals; the host remains responsible for execution. */
export function evaluateCryptoTailExit(params: {
  position: CryptoTailPositionSignal;
  policy: CryptoTailExitPolicy;
  oracle: CryptoTailOracleState;
  roundEndSec: number;
  nowSec: number;
  /** Optional: omit or pass `{ favoredOutcome: null }` when no OFI signal is wired up. */
  ofiSignal?: CryptoTailOfiSignal | null;
}): CryptoTailExitDecision {
  const secondsToEnd = params.roundEndSec - params.nowSec;
  if (secondsToEnd <= 0) {
    return {
      shouldExit: false,
      reasonCode: 'ROUND_ENDED',
      reasonMessage: 'Round has already ended.',
      distanceBps: null,
      currentDelta: null,
      secondsToEnd,
    };
  }
  // Checked ahead of the Chainlink-availability guard below: this signal comes from an
  // independent source and must still be able to fire a stop when the oracle feed is
  // temporarily missing or stale.
  if (
    params.policy.ofiReversalEnabled
    && params.position.outcome != null
    && params.ofiSignal?.favoredOutcome != null
    && params.ofiSignal.favoredOutcome !== params.position.outcome
  ) {
    return {
      shouldExit: true,
      reasonCode: 'OFI_REVERSAL',
      reasonMessage: `${params.position.outcome} entry invalidated because the live order-flow signal now favors ${params.ofiSignal.favoredOutcome}.`,
      distanceBps: null,
      currentDelta: null,
      secondsToEnd,
    };
  }
  if (!params.oracle.startPrice || !params.oracle.currentPrice || !params.oracle.fresh) {
    return {
      shouldExit: false,
      reasonCode: 'CHAINLINK_UNAVAILABLE',
      reasonMessage: 'Reference price is missing or stale for exit monitor.',
      distanceBps: null,
      currentDelta: null,
      secondsToEnd,
    };
  }

  const currentDelta = params.oracle.currentPrice - params.oracle.startPrice;
  const distanceBps = Math.abs(currentDelta) / params.oracle.startPrice * 10_000;
  if (
    params.policy.directionFlipEnabled
    && params.position.outcome === 'Up'
    && currentDelta < 0
  ) {
    return {
      shouldExit: true,
      reasonCode: 'DIRECTION_FLIPPED',
      reasonMessage: 'Up entry invalidated because the reference price moved below the round start price.',
      distanceBps,
      currentDelta,
      secondsToEnd,
    };
  }
  if (
    params.policy.directionFlipEnabled
    && params.position.outcome === 'Down'
    && currentDelta >= 0
  ) {
    return {
      shouldExit: true,
      reasonCode: 'DIRECTION_FLIPPED',
      reasonMessage: 'Down entry invalidated because the reference price moved back to or above the round start price.',
      distanceBps,
      currentDelta,
      secondsToEnd,
    };
  }
  if (
    params.policy.distanceCollapsePercent != null
    && params.position.entryDistanceBps != null
    && distanceBps < params.position.entryDistanceBps * params.policy.distanceCollapsePercent / 100
  ) {
    return {
      shouldExit: true,
      reasonCode: 'DISTANCE_COLLAPSED',
      reasonMessage: `Entry distance collapsed below ${params.policy.distanceCollapsePercent}% of the original signal distance.`,
      distanceBps,
      currentDelta,
      secondsToEnd,
    };
  }
  return {
    shouldExit: false,
    reasonCode: 'POSITION_HELD',
    reasonMessage: 'Exit conditions are not met.',
    distanceBps,
    currentDelta,
    secondsToEnd,
  };
}
