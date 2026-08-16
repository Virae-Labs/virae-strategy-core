import { buildCryptoTailEntryExecutionPlan } from '../execution';
import { createCryptoTailLifecycleState, reduceCryptoTailLifecycle } from '../lifecycle';
import { REFERENCE_CRYPTO_TAIL_CONFIG_V1 } from '../reference';

function plan() {
  const result = buildCryptoTailEntryExecutionPlan({
    config: REFERENCE_CRYPTO_TAIL_CONFIG_V1,
    decision: {
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
    },
  });
  if (!result.ok) throw new Error('expected plan');
  return result.plan;
}

describe('reduceCryptoTailLifecycle', () => {
  it('plans, submits, and opens an entry position deterministically', () => {
    let transition = reduceCryptoTailLifecycle(createCryptoTailLifecycleState(), {
      type: 'ENTRY_DECIDED',
      plan: plan(),
    });
    expect(transition.state.status).toBe('ENTRY_PLANNED');
    expect(transition.commands[0]).toMatchObject({ type: 'PLACE_ORDER' });

    transition = reduceCryptoTailLifecycle(transition.state, {
      type: 'ORDER_ACCEPTED',
      leg: 'ENTRY',
      orderId: 'order-1',
    });
    transition = reduceCryptoTailLifecycle(transition.state, {
      type: 'ORDER_FILLED',
      leg: 'ENTRY',
      cumulativeShares: 5.44,
      averagePrice: 0.92,
    });
    expect(transition.state).toMatchObject({
      status: 'POSITION_OPEN',
      entryFilledShares: 5.44,
      averageEntryPrice: 0.92,
    });
  });

  it('cancels an aged entry and preserves a partial fill as an open position', () => {
    let state = reduceCryptoTailLifecycle(createCryptoTailLifecycleState(), {
      type: 'ENTRY_DECIDED',
      plan: plan(),
    }).state;
    state = reduceCryptoTailLifecycle(state, {
      type: 'ORDER_ACCEPTED', leg: 'ENTRY', orderId: 'order-1',
    }).state;
    state = reduceCryptoTailLifecycle(state, {
      type: 'ORDER_PARTIALLY_FILLED', leg: 'ENTRY', cumulativeShares: 2, averagePrice: 0.92,
    }).state;
    const deadline = reduceCryptoTailLifecycle(state, { type: 'ENTRY_DEADLINE_REACHED' });
    expect(deadline.commands).toEqual([{ type: 'CANCEL_ORDER', leg: 'ENTRY', orderId: 'order-1' }]);
    expect(reduceCryptoTailLifecycle(deadline.state, { type: 'ORDER_CANCELLED', leg: 'ENTRY' }).state.status)
      .toBe('POSITION_OPEN');
  });

  it('stops new entries and cancels an outstanding entry on a risk stop', () => {
    let state = reduceCryptoTailLifecycle(createCryptoTailLifecycleState(), {
      type: 'ENTRY_DECIDED', plan: plan(),
    }).state;
    state = reduceCryptoTailLifecycle(state, {
      type: 'ORDER_ACCEPTED', leg: 'ENTRY', orderId: 'order-1',
    }).state;
    const stopped = reduceCryptoTailLifecycle(state, {
      type: 'RISK_STOPPED', reasonCode: 'DAILY_LOSS_STOP',
    });
    expect(stopped.state).toMatchObject({
      status: 'ENTRY_SUBMITTED',
      newEntriesStopped: true,
      stopReasonCode: 'DAILY_LOSS_STOP',
    });
    expect(stopped.commands).toEqual([
      { type: 'STOP_NEW_ENTRIES', reasonCode: 'DAILY_LOSS_STOP' },
      { type: 'CANCEL_ORDER', leg: 'ENTRY', orderId: 'order-1' },
    ]);
    expect(reduceCryptoTailLifecycle(stopped.state, { type: 'ORDER_CANCELLED', leg: 'ENTRY' }).state.status)
      .toBe('STOPPED');
  });

  it('keeps a residual position open when a smaller exit order is fully filled', () => {
    const state = {
      ...createCryptoTailLifecycleState(),
      status: 'EXIT_SUBMITTED' as const,
      entryFilledShares: 10,
      exitOrderId: 'exit-1',
    };

    expect(reduceCryptoTailLifecycle(state, {
      type: 'ORDER_FILLED',
      leg: 'EXIT',
      cumulativeShares: 4,
      averagePrice: 0.9,
    }).state).toMatchObject({
      status: 'POSITION_OPEN',
      exitOrderId: null,
      exitFilledShares: 4,
    });
  });

  it('completes only when cumulative exit fills cover the entry position', () => {
    const state = {
      ...createCryptoTailLifecycleState(),
      status: 'EXIT_SUBMITTED' as const,
      entryFilledShares: 10,
      exitOrderId: 'exit-1',
    };

    expect(reduceCryptoTailLifecycle(state, {
      type: 'ORDER_FILLED',
      leg: 'EXIT',
      cumulativeShares: 10,
      averagePrice: 0.9,
    }).state).toMatchObject({
      status: 'COMPLETED',
      exitOrderId: null,
      exitFilledShares: 10,
    });
  });
});
