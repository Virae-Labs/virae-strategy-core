import { CRYPTO_TAIL_STRATEGY_MANIFEST } from './manifest';
import type { CryptoTailDecisionResult, CryptoTailStrategyConfig } from './types';

export type CryptoTailLimitOrderIntent = {
  kind: 'LIMIT_ORDER';
  leg: 'ENTRY' | 'EXIT';
  side: 'BUY' | 'SELL';
  tokenId: string;
  outcome: 'Up' | 'Down';
  price: number;
  notionalUsd: number | null;
  shares: number;
  expiresAfterMs: number;
  reasonCode: string;
};

export type CryptoTailEntryExecutionPlan = {
  strategyId: typeof CRYPTO_TAIL_STRATEGY_MANIFEST.id;
  modelVersion: typeof CRYPTO_TAIL_STRATEGY_MANIFEST.modelVersion;
  order: CryptoTailLimitOrderIntent;
  chase: {
    enabled: boolean;
    maxTicks: number;
    askCap: number;
  };
  cancelUnfilledAfterMs: number;
  exitPolicy: {
    takeProfitPrice: number | null;
    orderbookStopPrice: number | null;
    orderbookStopSlippageBps: number;
    directionFlipEnabled: boolean;
    distanceCollapsePercent: number | null;
  };
};

export type CryptoTailExecutionPlanResult =
  | { ok: true; plan: CryptoTailEntryExecutionPlan }
  | { ok: false; reasonCode: 'DECISION_NOT_ELIGIBLE' | 'DECISION_PAYLOAD_INCOMPLETE' };

function entryShares(notionalUsd: number, price: number): number {
  return Math.ceil(notionalUsd / price * 100) / 100;
}

/** Converts an eligible decision into a bounded order intent and execution policy. */
export function buildCryptoTailEntryExecutionPlan(params: {
  decision: CryptoTailDecisionResult;
  config: CryptoTailStrategyConfig;
}): CryptoTailExecutionPlanResult {
  const { decision, config } = params;
  if (decision.decision !== 'ELIGIBLE') {
    return { ok: false, reasonCode: 'DECISION_NOT_ELIGIBLE' };
  }
  if (
    !decision.selectedTokenId
    || !decision.candidateOutcome
    || decision.limitPrice == null
    || decision.notionalUsd == null
    || !Number.isFinite(decision.limitPrice)
    || !Number.isFinite(decision.notionalUsd)
    || !(decision.limitPrice > 0 && decision.limitPrice < 1)
    || !(decision.notionalUsd > 0)
    || !Number.isFinite(config.entry.cancelAfterMs)
    || !(config.entry.cancelAfterMs > 0)
    || !Number.isFinite(config.entry.maxChaseTicks)
    || config.entry.maxChaseTicks < 0
    || !Number.isFinite(config.entry.askCap)
    || !(config.entry.askCap > 0 && config.entry.askCap < 1)
  ) {
    return { ok: false, reasonCode: 'DECISION_PAYLOAD_INCOMPLETE' };
  }

  const distanceCollapsePercent = config.entry.distanceCollapseStopEnabled
    ? config.entry.distanceCollapseStopPercent
    : null;
  return {
    ok: true,
    plan: {
      strategyId: CRYPTO_TAIL_STRATEGY_MANIFEST.id,
      modelVersion: CRYPTO_TAIL_STRATEGY_MANIFEST.modelVersion,
      order: {
        kind: 'LIMIT_ORDER',
        leg: 'ENTRY',
        side: 'BUY',
        tokenId: decision.selectedTokenId,
        outcome: decision.candidateOutcome,
        price: decision.limitPrice,
        notionalUsd: decision.notionalUsd,
        shares: entryShares(decision.notionalUsd, decision.limitPrice),
        expiresAfterMs: config.entry.cancelAfterMs,
        reasonCode: decision.reasonCode,
      },
      chase: {
        enabled: config.entry.entryOrderChaseEnabled && config.entry.maxChaseTicks > 0,
        maxTicks: config.entry.maxChaseTicks,
        askCap: config.entry.askCap,
      },
      cancelUnfilledAfterMs: config.entry.cancelAfterMs,
      exitPolicy: {
        takeProfitPrice: config.entry.takeProfitEnabled ? config.entry.takeProfitPrice : null,
        orderbookStopPrice: config.entry.orderbookStopEnabled ? config.entry.orderbookStopPrice : null,
        orderbookStopSlippageBps: config.entry.orderbookStopSlippageBps,
        directionFlipEnabled: config.entry.directionFlipStopEnabled,
        distanceCollapsePercent,
      },
    },
  };
}

export type CryptoTailChaseEligibilityInput = {
  alreadyChased: boolean;
  maxChaseTicks: number;
  tickSize: number;
  askCap: number;
  originalPrice: number;
  cancelAfterMs: number;
  roundEndSec: number | null;
  nowSec: number;
};

export type CryptoTailChaseEligibilityResult =
  | { eligible: true; chasePrice: number }
  | { eligible: false; reason:
      | 'ALREADY_CHASED'
      | 'CHASE_DISABLED'
      | 'CHASE_INPUT_INVALID'
      | 'ORIGINAL_PRICE_UNKNOWN'
      | 'ROUND_END_UNKNOWN'
      | 'INSUFFICIENT_TIME_REMAINING'
      | 'CHASE_PRICE_EXCEEDS_ASK_CAP' };

/** Evaluates a single bounded chase without cancelling or submitting any order. */
export function evaluateCryptoTailChase(
  input: CryptoTailChaseEligibilityInput,
): CryptoTailChaseEligibilityResult {
  if (input.alreadyChased) return { eligible: false, reason: 'ALREADY_CHASED' };
  if (!Number.isFinite(input.maxChaseTicks) || input.maxChaseTicks <= 0) return { eligible: false, reason: 'CHASE_DISABLED' };
  if (!Number.isFinite(input.originalPrice)) return { eligible: false, reason: 'ORIGINAL_PRICE_UNKNOWN' };
  if (input.roundEndSec == null) return { eligible: false, reason: 'ROUND_END_UNKNOWN' };
  if (!Number.isInteger(input.maxChaseTicks)
    || !Number.isFinite(input.tickSize)
    || !(input.tickSize > 0 && input.tickSize < 1)
    || !Number.isFinite(input.askCap)
    || !(input.askCap > 0 && input.askCap < 1)
    || !Number.isFinite(input.cancelAfterMs)
    || !(input.cancelAfterMs > 0)
    || !Number.isFinite(input.roundEndSec)
    || !Number.isFinite(input.nowSec)) {
    return { eligible: false, reason: 'CHASE_INPUT_INVALID' };
  }
  const secondsRemaining = input.roundEndSec - input.nowSec;
  const minRemainingSeconds = input.cancelAfterMs / 1000;
  if (secondsRemaining < minRemainingSeconds) {
    return { eligible: false, reason: 'INSUFFICIENT_TIME_REMAINING' };
  }
  const chasePrice = Math.round((input.originalPrice + input.maxChaseTicks * input.tickSize) * 1e6) / 1e6;
  if (!Number.isFinite(chasePrice) || !(chasePrice > 0 && chasePrice < 1)) {
    return { eligible: false, reason: 'CHASE_INPUT_INVALID' };
  }
  if (chasePrice > input.askCap) return { eligible: false, reason: 'CHASE_PRICE_EXCEEDS_ASK_CAP' };
  return { eligible: true, chasePrice };
}

/** Returns a replacement intent without mutating the original execution plan. */
export function buildCryptoTailChaseOrder(
  plan: CryptoTailEntryExecutionPlan,
  chasePrice: number,
): CryptoTailLimitOrderIntent {
  if (!Number.isFinite(chasePrice) || !(chasePrice > 0 && chasePrice < 1)) {
    throw new RangeError('Crypto Tail chase price must be finite and between 0 and 1.');
  }
  return {
    ...plan.order,
    price: chasePrice,
    shares: plan.order.notionalUsd == null
      ? plan.order.shares
      : entryShares(plan.order.notionalUsd, chasePrice),
    reasonCode: 'ENTRY_CHASE',
  };
}
