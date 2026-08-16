export type PreMarketLadderMode = 'SAFE' | 'NORMAL' | 'AGGRESSIVE';
export type PreMarketOutcome = 'Up' | 'Down';

export type PreMarketStrategyConfig = {
  mode: PreMarketLadderMode;
  sideBudgetUsd: number;
  launchLeadSeconds: number;
  launchGraceSeconds: number;
  cancelAfterOpenSeconds: number;
  takeProfitDelaySeconds: number;
  minimumTakeProfitPrice: number;
  takeProfitMultiplier: number;
};

export type PreMarketRoundInput = {
  roundKey: string;
  roundStartSec: number;
  roundEndSec: number;
  nowSec: number;
  marketActive: boolean;
  acceptingOrders: boolean;
  upTokenId: string;
  downTokenId: string;
};

export type PreMarketEntryIntent = {
  intentKey: string;
  leg: 'ENTRY';
  side: 'BUY';
  outcome: PreMarketOutcome;
  tokenId: string;
  rung: number;
  price: number;
  notionalUsd: number;
  shares: number;
  cancelAtSec: number;
};

export type PreMarketFilledPosition = {
  outcome: PreMarketOutcome;
  tokenId: string;
  filledShares: number;
  filledNotionalUsd: number;
  bestAsk: number | null;
};

export type PreMarketTakeProfitIntent = {
  intentKey: string;
  leg: 'TAKE_PROFIT';
  side: 'SELL';
  outcome: PreMarketOutcome;
  tokenId: string;
  price: number;
  shares: number;
};
