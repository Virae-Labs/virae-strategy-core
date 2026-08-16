import type { CryptoTailEntryExecutionPlan, CryptoTailLimitOrderIntent } from './execution';

export type CryptoTailLifecycleStatus =
  | 'IDLE'
  | 'ENTRY_PLANNED'
  | 'ENTRY_SUBMITTED'
  | 'ENTRY_PARTIALLY_FILLED'
  | 'POSITION_OPEN'
  | 'EXIT_PLANNED'
  | 'EXIT_SUBMITTED'
  | 'COMPLETED'
  | 'STOPPED'
  | 'ERROR';

export type CryptoTailLifecycleState = {
  status: CryptoTailLifecycleStatus;
  entryPlan: CryptoTailEntryExecutionPlan | null;
  entryOrderId: string | null;
  exitOrderId: string | null;
  entryFilledShares: number;
  exitFilledShares: number;
  averageEntryPrice: number | null;
  averageExitPrice: number | null;
  newEntriesStopped: boolean;
  stopReasonCode: string | null;
  errorCode: string | null;
};

export type CryptoTailLifecycleEvent =
  | { type: 'ENTRY_DECIDED'; plan: CryptoTailEntryExecutionPlan }
  | { type: 'ORDER_ACCEPTED'; leg: 'ENTRY' | 'EXIT'; orderId: string }
  | { type: 'ORDER_PARTIALLY_FILLED'; leg: 'ENTRY' | 'EXIT'; cumulativeShares: number; averagePrice: number }
  | { type: 'ORDER_FILLED'; leg: 'ENTRY' | 'EXIT'; cumulativeShares: number; averagePrice: number }
  | { type: 'ORDER_CANCELLED'; leg: 'ENTRY' | 'EXIT' }
  | { type: 'ENTRY_DEADLINE_REACHED' }
  | { type: 'EXIT_DECIDED'; order: CryptoTailLimitOrderIntent }
  | { type: 'RISK_STOPPED'; reasonCode: string }
  | { type: 'ROUND_SETTLED' }
  | { type: 'EXECUTION_FAILED'; code: string };

export type CryptoTailLifecycleCommand =
  | { type: 'PLACE_ORDER'; order: CryptoTailLimitOrderIntent }
  | { type: 'CANCEL_ORDER'; leg: 'ENTRY' | 'EXIT'; orderId: string }
  | { type: 'STOP_NEW_ENTRIES'; reasonCode: string };

export type CryptoTailLifecycleTransition = {
  state: CryptoTailLifecycleState;
  commands: CryptoTailLifecycleCommand[];
};

/** Creates a serializable initial lifecycle state. */
export function createCryptoTailLifecycleState(): CryptoTailLifecycleState {
  return {
    status: 'IDLE',
    entryPlan: null,
    entryOrderId: null,
    exitOrderId: null,
    entryFilledShares: 0,
    exitFilledShares: 0,
    averageEntryPrice: null,
    averageExitPrice: null,
    newEntriesStopped: false,
    stopReasonCode: null,
    errorCode: null,
  };
}

function transition(
  state: CryptoTailLifecycleState,
  patch: Partial<CryptoTailLifecycleState>,
  commands: CryptoTailLifecycleCommand[] = [],
): CryptoTailLifecycleTransition {
  return { state: { ...state, ...patch }, commands };
}

/**
 * Pure lifecycle reducer. Returned commands are descriptions that a durable,
 * idempotent host adapter must validate and execute.
 */
export function reduceCryptoTailLifecycle(
  state: CryptoTailLifecycleState,
  event: CryptoTailLifecycleEvent,
): CryptoTailLifecycleTransition {
  if (event.type === 'ENTRY_DECIDED') {
    if (state.status !== 'IDLE' || state.newEntriesStopped) return transition(state, {});
    return transition(state, { status: 'ENTRY_PLANNED', entryPlan: event.plan }, [
      { type: 'PLACE_ORDER', order: event.plan.order },
    ]);
  }
  if (event.type === 'ORDER_ACCEPTED') {
    if (event.leg === 'ENTRY' && ['ENTRY_PLANNED', 'ENTRY_SUBMITTED'].includes(state.status)) {
      return transition(state, { status: 'ENTRY_SUBMITTED', entryOrderId: event.orderId });
    }
    if (event.leg === 'EXIT' && ['EXIT_PLANNED', 'EXIT_SUBMITTED'].includes(state.status)) {
      return transition(state, { status: 'EXIT_SUBMITTED', exitOrderId: event.orderId });
    }
    return transition(state, {});
  }
  if (event.type === 'ORDER_PARTIALLY_FILLED' || event.type === 'ORDER_FILLED') {
    if (event.leg === 'ENTRY') {
      return transition(state, {
        status: event.type === 'ORDER_FILLED' ? 'POSITION_OPEN' : 'ENTRY_PARTIALLY_FILLED',
        entryFilledShares: event.cumulativeShares,
        averageEntryPrice: event.averagePrice,
      });
    }
    const fullyExited = event.cumulativeShares + Number.EPSILON >= state.entryFilledShares;
    return transition(state, {
      status: fullyExited
        ? 'COMPLETED'
        : event.type === 'ORDER_FILLED' ? 'POSITION_OPEN' : 'EXIT_SUBMITTED',
      exitOrderId: event.type === 'ORDER_FILLED' ? null : state.exitOrderId,
      exitFilledShares: event.cumulativeShares,
      averageExitPrice: event.averagePrice,
    });
  }
  if (event.type === 'ENTRY_DEADLINE_REACHED') {
    if (
      !['ENTRY_SUBMITTED', 'ENTRY_PARTIALLY_FILLED'].includes(state.status)
      || !state.entryOrderId
    ) return transition(state, {});
    return transition(state, {}, [
      { type: 'CANCEL_ORDER', leg: 'ENTRY', orderId: state.entryOrderId },
    ]);
  }
  if (event.type === 'ORDER_CANCELLED') {
    if (event.leg === 'ENTRY') {
      return transition(state, {
        status: state.entryFilledShares > 0
          ? 'POSITION_OPEN'
          : state.newEntriesStopped ? 'STOPPED' : 'IDLE',
        entryOrderId: null,
      });
    }
    return transition(state, {
      status: state.entryFilledShares > state.exitFilledShares ? 'POSITION_OPEN' : 'COMPLETED',
      exitOrderId: null,
    });
  }
  if (event.type === 'EXIT_DECIDED') {
    if (state.status !== 'POSITION_OPEN') return transition(state, {});
    return transition(state, { status: 'EXIT_PLANNED' }, [
      { type: 'PLACE_ORDER', order: event.order },
    ]);
  }
  if (event.type === 'RISK_STOPPED') {
    const commands: CryptoTailLifecycleCommand[] = [
      { type: 'STOP_NEW_ENTRIES', reasonCode: event.reasonCode },
    ];
    if (state.entryOrderId && ['ENTRY_SUBMITTED', 'ENTRY_PARTIALLY_FILLED'].includes(state.status)) {
      commands.push({ type: 'CANCEL_ORDER', leg: 'ENTRY', orderId: state.entryOrderId });
    }
    return transition(state, {
      status: state.status === 'IDLE' ? 'STOPPED' : state.status,
      newEntriesStopped: true,
      stopReasonCode: event.reasonCode,
    }, commands);
  }
  if (event.type === 'ROUND_SETTLED') {
    return transition(state, { status: 'COMPLETED' });
  }
  return transition(state, { status: 'ERROR', errorCode: event.code });
}
