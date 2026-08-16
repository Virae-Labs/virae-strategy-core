import {
  buildCryptoTailChaseOrder,
  buildCryptoTailEntryExecutionPlan,
  evaluateCryptoTailChase,
} from '../execution';
import { REFERENCE_CRYPTO_TAIL_CONFIG_V1 } from '../reference';
import type { CryptoTailDecisionResult } from '../types';

function eligibleDecision(): CryptoTailDecisionResult {
  return {
    decision: 'ELIGIBLE',
    reasonCode: 'ENTRY_READY',
    reasonMessage: 'Entry gates passed.',
    candidateOutcome: 'Up',
    selectedTokenId: 'up-token',
    secondsToEnd: 20,
    distanceBps: 12,
    estimatedWinProbability: 0.95,
    estimatedAllInCost: 0.93,
    edge: 0.02,
    notionalUsd: 5,
    limitPrice: 0.92,
  };
}

describe('buildCryptoTailEntryExecutionPlan', () => {
  it('turns an eligible decision into a bounded limit-order plan', () => {
    expect(buildCryptoTailEntryExecutionPlan({
      decision: eligibleDecision(),
      config: REFERENCE_CRYPTO_TAIL_CONFIG_V1,
    })).toEqual({
      ok: true,
      plan: expect.objectContaining({
        strategyId: 'crypto-tail-directional',
        modelVersion: 'heuristic-v2-twap',
        order: expect.objectContaining({
          leg: 'ENTRY',
          side: 'BUY',
          tokenId: 'up-token',
          price: 0.92,
          notionalUsd: 5,
          shares: 5.44,
          expiresAfterMs: 10_000,
        }),
        chase: { enabled: true, maxTicks: 1, askCap: 0.95 },
      }),
    });
  });

  it('does not plan execution for a skipped decision', () => {
    expect(buildCryptoTailEntryExecutionPlan({
      decision: { ...eligibleDecision(), decision: 'SKIP' },
      config: REFERENCE_CRYPTO_TAIL_CONFIG_V1,
    })).toEqual({ ok: false, reasonCode: 'DECISION_NOT_ELIGIBLE' });
  });
});

describe('evaluateCryptoTailChase', () => {
  it('allows a single tick chase while time and price caps permit it', () => {
    expect(evaluateCryptoTailChase({
      alreadyChased: false,
      maxChaseTicks: 1,
      tickSize: 0.01,
      askCap: 0.95,
      originalPrice: 0.92,
      cancelAfterMs: 10_000,
      roundEndSec: 120,
      nowSec: 100,
    })).toEqual({ eligible: true, chasePrice: 0.93 });
  });

  it('blocks a chase that would exceed the configured ask cap', () => {
    expect(evaluateCryptoTailChase({
      alreadyChased: false,
      maxChaseTicks: 2,
      tickSize: 0.01,
      askCap: 0.93,
      originalPrice: 0.92,
      cancelAfterMs: 10_000,
      roundEndSec: 120,
      nowSec: 100,
    })).toEqual({ eligible: false, reason: 'CHASE_PRICE_EXCEEDS_ASK_CAP' });
  });

  it('builds a replacement intent without mutating the original plan', () => {
    const result = buildCryptoTailEntryExecutionPlan({
      decision: eligibleDecision(),
      config: REFERENCE_CRYPTO_TAIL_CONFIG_V1,
    });
    if (!result.ok) throw new Error('expected plan');
    const chase = buildCryptoTailChaseOrder(result.plan, 0.93);
    expect(chase).toMatchObject({ price: 0.93, shares: 5.38, reasonCode: 'ENTRY_CHASE' });
    expect(result.plan.order.price).toBe(0.92);
  });
});
