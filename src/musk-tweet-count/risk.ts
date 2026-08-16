import type { MuskTweetRiskState } from './types';

export type MuskTweetOrderSizingMode = 'FIXED_ORDER_AMOUNT' | 'TASK_BANKROLL' | 'FRACTIONAL_KELLY';
export type MuskTweetPersistentRiskStopReason =
  | 'TASK_NET_LOSS_STOP'
  | 'TASK_NET_PROFIT_STOP'
  | 'TASK_BANKROLL_FLOOR_STOP';

export function resolveMuskTweetPersistentRiskStop(params: {
  maxTaskNetLossUsd: number | null;
  maxTaskNetProfitUsd: number | null;
  risk: MuskTweetRiskState;
  orderSizingMode: MuskTweetOrderSizingMode;
  taskEquityUsd: number;
  minRemainingBankrollUsd: number | null;
}): MuskTweetPersistentRiskStopReason | null {
  if (
    params.maxTaskNetProfitUsd != null
    && (params.risk.taskNetAfterFeePnlUsd ?? params.risk.taskNetPnlUsd ?? 0) >= params.maxTaskNetProfitUsd
  ) return 'TASK_NET_PROFIT_STOP';
  if (
    params.maxTaskNetLossUsd != null
    && -(params.risk.taskNetPnlUsd ?? -params.risk.taskNetLossUsd) >= params.maxTaskNetLossUsd
  ) return 'TASK_NET_LOSS_STOP';
  if (
    params.orderSizingMode === 'TASK_BANKROLL'
    && params.minRemainingBankrollUsd != null
    && params.taskEquityUsd <= params.minRemainingBankrollUsd
  ) return 'TASK_BANKROLL_FLOOR_STOP';
  return null;
}
