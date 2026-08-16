import {
  buildCryptoTailEntryExecutionPlan,
  createCryptoTailLifecycleState,
  decideCryptoTailEntry,
  evaluateCryptoTailExit,
  reduceCryptoTailLifecycle,
  type CryptoTailLimitOrderIntent,
} from '../../src/crypto-tail';
import { eligibleCryptoTailInput } from '../helpers/fixtures';

describe('Crypto Tail end-to-end pure flow', () => {
  it('moves from an eligible snapshot through entry, exit, and completion', () => {
    const input = eligibleCryptoTailInput();
    const decision = decideCryptoTailEntry(input);
    expect(decision).toMatchObject({
      decision: 'ELIGIBLE',
      reasonCode: 'ENTRY_READY',
      candidateOutcome: 'Up',
      selectedTokenId: 'up-token',
      notionalUsd: 5,
      limitPrice: 0.92,
    });

    const planned = buildCryptoTailEntryExecutionPlan({ decision, config: input.config });
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error(planned.reasonCode);

    let transition = reduceCryptoTailLifecycle(createCryptoTailLifecycleState(), {
      type: 'ENTRY_DECIDED',
      plan: planned.plan,
    });
    expect(transition.commands).toEqual([{ type: 'PLACE_ORDER', order: planned.plan.order }]);

    transition = reduceCryptoTailLifecycle(transition.state, {
      type: 'ORDER_ACCEPTED',
      leg: 'ENTRY',
      orderId: 'entry-1',
    });
    transition = reduceCryptoTailLifecycle(transition.state, {
      type: 'ORDER_FILLED',
      leg: 'ENTRY',
      cumulativeShares: planned.plan.order.shares,
      averagePrice: planned.plan.order.price,
    });
    expect(transition.state.status).toBe('POSITION_OPEN');

    const exit = evaluateCryptoTailExit({
      position: {
        outcome: decision.candidateOutcome,
        entryDistanceBps: decision.distanceBps,
      },
      policy: planned.plan.exitPolicy,
      oracle: {
        ...input.chainlink,
        currentPrice: 99_990,
      },
      roundEndSec: input.round!.roundEndSec,
      nowSec: input.nowSec + 1,
    });
    expect(exit).toMatchObject({ shouldExit: true, reasonCode: 'DIRECTION_FLIPPED' });

    const exitOrder: CryptoTailLimitOrderIntent = {
      kind: 'LIMIT_ORDER',
      leg: 'EXIT',
      side: 'SELL',
      tokenId: planned.plan.order.tokenId,
      outcome: planned.plan.order.outcome,
      price: 0.9,
      notionalUsd: null,
      shares: transition.state.entryFilledShares,
      expiresAfterMs: 10_000,
      reasonCode: exit.reasonCode,
    };
    transition = reduceCryptoTailLifecycle(transition.state, { type: 'EXIT_DECIDED', order: exitOrder });
    expect(transition.commands).toEqual([{ type: 'PLACE_ORDER', order: exitOrder }]);
    transition = reduceCryptoTailLifecycle(transition.state, {
      type: 'ORDER_ACCEPTED',
      leg: 'EXIT',
      orderId: 'exit-1',
    });
    transition = reduceCryptoTailLifecycle(transition.state, {
      type: 'ORDER_FILLED',
      leg: 'EXIT',
      cumulativeShares: exitOrder.shares,
      averagePrice: exitOrder.price,
    });
    expect(transition.state).toMatchObject({
      status: 'COMPLETED',
      entryOrderId: 'entry-1',
      exitOrderId: null,
      entryFilledShares: planned.plan.order.shares,
      exitFilledShares: planned.plan.order.shares,
    });
  });

  it('is deterministic and does not mutate the caller snapshot', () => {
    const input = eligibleCryptoTailInput();
    const before = JSON.stringify(input);
    const first = decideCryptoTailEntry(input);
    const second = decideCryptoTailEntry(input);

    expect(second).toEqual(first);
    expect(JSON.stringify(input)).toBe(before);
  });
});
