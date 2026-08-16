import { PRE_MARKET_LADDER_WEIGHTS, normalizePreMarketStrategyConfig, preMarketPricesForMode } from './config';
import type { PreMarketEntryIntent, PreMarketFilledPosition, PreMarketRoundInput, PreMarketStrategyConfig, PreMarketTakeProfitIntent } from './types';

export const PRE_MARKET_STRATEGY_MANIFEST = {
  id: 'polymarket-btc-15m-premarket-dual-ladder',
  modelVersion: 'pre-m-live-v1',
  inputSchemaVersion: 1,
  executionPolicyVersion: 1,
} as const;

export type PreMarketEntryPlanResult =
  | { ok: true; intents: PreMarketEntryIntent[]; cancelAtSec: number }
  | { ok: false; reasonCode: 'INVALID_ROUND' | 'MARKET_UNAVAILABLE' | 'TOKEN_IDS_MISSING' | 'TOKEN_IDS_INVALID' | 'OUTSIDE_LAUNCH_WINDOW' };

const money = (value: number) => Math.round(value * 1e6) / 1e6;
const shares = (notional: number, price: number) => Math.floor(notional / price * 100) / 100;

export function buildPreMarketEntryPlan(params: {
  round: PreMarketRoundInput;
  config?: Partial<PreMarketStrategyConfig>;
}): PreMarketEntryPlanResult {
  const config = normalizePreMarketStrategyConfig(params.config);
  const { round } = params;
  if (
    !round.roundKey?.trim()
    || round.roundKey !== round.roundKey.trim()
    || !Number.isFinite(round.roundStartSec)
    || !Number.isFinite(round.roundEndSec)
    || !Number.isFinite(round.nowSec)
    || round.roundEndSec <= round.roundStartSec
  ) return { ok: false, reasonCode: 'INVALID_ROUND' };
  if (!round.marketActive || !round.acceptingOrders) return { ok: false, reasonCode: 'MARKET_UNAVAILABLE' };
  if (!round.upTokenId?.trim() || !round.downTokenId?.trim()) return { ok: false, reasonCode: 'TOKEN_IDS_MISSING' };
  if (
    round.upTokenId !== round.upTokenId.trim()
    || round.downTokenId !== round.downTokenId.trim()
    || round.upTokenId === round.downTokenId
  ) return { ok: false, reasonCode: 'TOKEN_IDS_INVALID' };
  const launchAt = round.roundStartSec - config.launchLeadSeconds;
  if (round.nowSec < launchAt || round.nowSec > round.roundStartSec + config.launchGraceSeconds) {
    return { ok: false, reasonCode: 'OUTSIDE_LAUNCH_WINDOW' };
  }
  const prices = preMarketPricesForMode(config.mode);
  const cancelAtSec = round.roundStartSec + config.cancelAfterOpenSeconds;
  const outcomes = [
    { outcome: 'Up' as const, tokenId: round.upTokenId },
    { outcome: 'Down' as const, tokenId: round.downTokenId },
  ];
  const intents = outcomes.flatMap(({ outcome, tokenId }) => prices.map((price, index) => {
    const notionalUsd = money(config.sideBudgetUsd * PRE_MARKET_LADDER_WEIGHTS[index]);
    return {
      intentKey: `${round.roundKey}:ENTRY:${outcome.toUpperCase()}:${index + 1}`,
      leg: 'ENTRY' as const,
      side: 'BUY' as const,
      outcome,
      tokenId,
      rung: index + 1,
      price,
      notionalUsd,
      shares: shares(notionalUsd, price),
      cancelAtSec,
    };
  }));
  return { ok: true, intents, cancelAtSec };
}

export function buildPreMarketTakeProfitIntents(params: {
  roundKey: string;
  roundStartSec: number;
  nowSec: number;
  positions: PreMarketFilledPosition[];
  config?: Partial<PreMarketStrategyConfig>;
}): PreMarketTakeProfitIntent[] {
  const config = normalizePreMarketStrategyConfig(params.config);
  if (
    !params.roundKey?.trim()
    || params.roundKey !== params.roundKey.trim()
    || !Number.isFinite(params.roundStartSec)
    || !Number.isFinite(params.nowSec)
  ) return [];
  if (params.nowSec < params.roundStartSec + config.takeProfitDelaySeconds) return [];

  const positionsByOutcome = new Map<PreMarketFilledPosition['outcome'], {
    tokenId: string;
    filledShares: number;
    filledNotionalUsd: number;
    bestAsk: number | null;
  }>();
  for (const position of params.positions) {
    const noFill = position.filledShares === 0 && position.filledNotionalUsd === 0;
    const validBestAsk = position.bestAsk === null
      || (Number.isFinite(position.bestAsk) && position.bestAsk >= 0.01 && position.bestAsk <= 0.99);
    if (noFill) continue;
    if (
      !['Up', 'Down'].includes(position.outcome)
      || !position.tokenId?.trim()
      || position.tokenId !== position.tokenId.trim()
      || !Number.isFinite(position.filledShares)
      || !Number.isFinite(position.filledNotionalUsd)
      || !(position.filledShares > 0)
      || !(position.filledNotionalUsd > 0)
      || !validBestAsk
    ) return [];
    const current = positionsByOutcome.get(position.outcome);
    if (current && current.tokenId !== position.tokenId) return [];
    positionsByOutcome.set(position.outcome, {
      tokenId: position.tokenId,
      filledShares: (current?.filledShares ?? 0) + position.filledShares,
      filledNotionalUsd: (current?.filledNotionalUsd ?? 0) + position.filledNotionalUsd,
      bestAsk: Math.max(current?.bestAsk ?? 0, position.bestAsk ?? 0) || null,
    });
  }

  return (['Up', 'Down'] as const).flatMap((outcome) => {
    const position = positionsByOutcome.get(outcome);
    if (!position) return [];
    const sellableShares = Math.floor(position.filledShares * 100) / 100;
    if (sellableShares < 0.01) return [];
    const averageEntry = position.filledNotionalUsd / position.filledShares;
    const rawTarget = Math.max(
      config.minimumTakeProfitPrice,
      averageEntry * config.takeProfitMultiplier,
      position.bestAsk ?? 0,
    );
    const price = Math.min(0.99, Math.ceil(rawTarget * 100) / 100);
    return [{
      intentKey: `${params.roundKey}:TAKE_PROFIT:${outcome.toUpperCase()}`,
      leg: 'TAKE_PROFIT' as const,
      side: 'SELL' as const,
      outcome,
      tokenId: position.tokenId,
      price,
      shares: sellableShares,
    }];
  });
}
