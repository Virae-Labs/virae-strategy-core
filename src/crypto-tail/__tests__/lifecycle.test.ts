import { buildCryptoTailEntryExecutionPlan } from '../execution';
import { createCryptoTailLifecycleState, reduceCryptoTailLifecycle } from '../lifecycle';
import type { CryptoTailLifecycleState } from '../lifecycle';
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

  it('ignores entry decisions after the lifecycle has started or entries are stopped', () => {
    const active = { ...createCryptoTailLifecycleState(), status: 'POSITION_OPEN' as const };
    expect(reduceCryptoTailLifecycle(active, { type: 'ENTRY_DECIDED', plan: plan() }))
      .toEqual({ state: active, commands: [] });

    const stopped = { ...createCryptoTailLifecycleState(), newEntriesStopped: true };
    expect(reduceCryptoTailLifecycle(stopped, { type: 'ENTRY_DECIDED', plan: plan() }))
      .toEqual({ state: stopped, commands: [] });
  });

  it('handles exit acceptance, partial fill, cancellation, and residual reopening', () => {
    let state: CryptoTailLifecycleState = {
      ...createCryptoTailLifecycleState(),
      status: 'POSITION_OPEN' as const,
      entryFilledShares: 10,
    };
    const order = { ...plan().order, leg: 'EXIT' as const, side: 'SELL' as const, shares: 10 };
    state = reduceCryptoTailLifecycle(state, { type: 'EXIT_DECIDED', order }).state;
    state = reduceCryptoTailLifecycle(state, { type: 'ORDER_ACCEPTED', leg: 'EXIT', orderId: 'exit-1' }).state;
    expect(state).toMatchObject({ status: 'EXIT_SUBMITTED', exitOrderId: 'exit-1' });
    state = reduceCryptoTailLifecycle(state, {
      type: 'ORDER_PARTIALLY_FILLED', leg: 'EXIT', cumulativeShares: 4, averagePrice: 0.9,
    }).state;
    expect(state).toMatchObject({ status: 'EXIT_SUBMITTED', exitFilledShares: 4 });
    state = reduceCryptoTailLifecycle(state, { type: 'ORDER_CANCELLED', leg: 'EXIT' }).state;
    expect(state).toMatchObject({ status: 'POSITION_OPEN', exitOrderId: null });
  });

  it('stops an idle lifecycle and settles or errors deterministically', () => {
    const stopped = reduceCryptoTailLifecycle(createCryptoTailLifecycleState(), {
      type: 'RISK_STOPPED', reasonCode: 'GLOBAL_STOP',
    });
    expect(stopped).toMatchObject({
      state: { status: 'STOPPED', newEntriesStopped: true, stopReasonCode: 'GLOBAL_STOP' },
      commands: [{ type: 'STOP_NEW_ENTRIES', reasonCode: 'GLOBAL_STOP' }],
    });

    expect(reduceCryptoTailLifecycle(stopped.state, { type: 'ROUND_SETTLED' }).state.status).toBe('COMPLETED');
    expect(reduceCryptoTailLifecycle(createCryptoTailLifecycleState(), {
      type: 'EXECUTION_FAILED', code: 'VENUE_UNAVAILABLE',
    }).state).toMatchObject({ status: 'ERROR', errorCode: 'VENUE_UNAVAILABLE' });
  });

  it('ignores entry deadlines and exit decisions in invalid states', () => {
    const initial = createCryptoTailLifecycleState();
    expect(reduceCryptoTailLifecycle(initial, { type: 'ENTRY_DEADLINE_REACHED' }))
      .toEqual({ state: initial, commands: [] });
    expect(reduceCryptoTailLifecycle(initial, { type: 'EXIT_DECIDED', order: plan().order }))
      .toEqual({ state: initial, commands: [] });
  });

  it('ignores out-of-order, regressing, and overfilled lifecycle events', () => {
    const initial = createCryptoTailLifecycleState();
    expect(reduceCryptoTailLifecycle(initial, {
      type: 'ORDER_FILLED', leg: 'EXIT', cumulativeShares: 1, averagePrice: 0.9,
    })).toEqual({ state: initial, commands: [] });
    expect(reduceCryptoTailLifecycle(initial, { type: 'ORDER_CANCELLED', leg: 'EXIT' }))
      .toEqual({ state: initial, commands: [] });

    const exiting: CryptoTailLifecycleState = {
      ...initial,
      status: 'EXIT_SUBMITTED',
      entryFilledShares: 10,
      exitFilledShares: 4,
      exitOrderId: 'exit-1',
    };
    for (const event of [
      { type: 'ORDER_PARTIALLY_FILLED', leg: 'EXIT', cumulativeShares: 3, averagePrice: 0.9 },
      { type: 'ORDER_FILLED', leg: 'EXIT', cumulativeShares: 11, averagePrice: 0.9 },
      { type: 'ORDER_FILLED', leg: 'ENTRY', cumulativeShares: 11, averagePrice: 0.92 },
    ] as const) {
      expect(reduceCryptoTailLifecycle(exiting, event)).toEqual({ state: exiting, commands: [] });
    }
  });
});
