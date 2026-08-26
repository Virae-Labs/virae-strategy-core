import { REFERENCE_CRYPTO_TAIL_CONFIG_V1 } from '../crypto-tail';
import { decideBtc15mValueSnipeEntry } from './decision';
import type { Btc15mValueSnipeVenue } from './manifest';
import type {
  Btc15mValueSnipeDecisionInput,
  Btc15mValueSnipeSimulationCategory,
  Btc15mValueSnipeSimulationRowResult,
  Btc15mValueSnipeSimulationScenario,
} from './types';

function baseInput(venue: Btc15mValueSnipeVenue): Btc15mValueSnipeDecisionInput {
  const nowSec = 1_800_000_880;
  const priceModel = venue === 'PREDICT_FUN'
    ? { kind: 'binance' as const, asset: 'BTC', windowSeconds: null, configId: null }
    : { kind: 'chainlink-spot' as const, asset: 'BTC', windowSeconds: null, configId: null };
  return {
    venue,
    estimatedAllInCost: 0.915,
    config: { minEdgeBps: 150 },
    snapshot: {
      strategyLabel: 'BTC 15m Value Snipe',
      settlementPairLabel: venue === 'PREDICT_FUN' ? 'BTC/USDT' : 'BTC/USD',
      nowSec,
      round: {
        roundKey: `${venue.toLowerCase()}-btc15m-1800000000`, eventSlug: null, eventTitle: null,
        eventImage: null, eventIcon: null, marketId: 'market-1', marketQuestion: null,
        marketImage: null, marketIcon: null, upTokenId: 'up-token', downTokenId: 'down-token',
        upOutcomeLabel: 'Up', downOutcomeLabel: 'Down', roundStartSec: 1_800_000_000,
        roundEndSec: 1_800_000_900, priceToBeat: 100_000,
        priceToBeatSource: venue === 'PREDICT_FUN' ? 'binance' : 'chainlink', resolutionPriceModel: priceModel,
        active: true, closed: false, acceptingOrders: true, enableOrderBook: true,
        orderMinSize: null, liquidityClob: venue === 'PREDICT_FUN' ? 1_000 : 20_000,
        settlementSourceOk: true, metadataFresh: true,
      },
      chainlink: { startPrice: 100_000, currentPrice: 100_120, currentPointTs: nowSec, fresh: true, priceModel },
      orderbook: { bestAsk: 0.91, bestBid: 0.905, spread: 0.005, topDepthUsd: 500, fresh: true },
      config: {
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          minEntryAsk: 0.8,
          askCap: 0.99,
          edgeGateEnabled: false,
          absoluteDistanceGateEnabled: false,
          consistencyGateEnabled: false,
          entryWindowStartSeconds: 120,
          entryWindowEndSeconds: 4,
          entryWindows: [{ secondsToEndMin: 1, minDistanceBps: 0 }],
          minLiquidityClob: venue === 'PREDICT_FUN' ? 100 : 1_000,
          depthMultiplier: 1,
          entryOrderChaseEnabled: false,
        },
        risk: REFERENCE_CRYPTO_TAIL_CONFIG_V1.risk,
      },
      risk: { dailyLossUsd: 0, taskNetLossUsd: 0, consecutiveLosses: 0, tradesToday: 0, hasRoundExecution: false },
      global: { enabled: true, liveTradingEnabled: true, maxNotionalUsd: null },
    },
  };
}

function scenario(
  venue: Btc15mValueSnipeVenue,
  id: string,
  category: Btc15mValueSnipeSimulationCategory,
  description: string,
  mutate: (input: Btc15mValueSnipeDecisionInput) => void,
  decision: string,
  reasonCode: Btc15mValueSnipeSimulationScenario['expected']['reasonCode'],
): Btc15mValueSnipeSimulationScenario {
  const input = baseInput(venue);
  mutate(input);
  return { id: `${venue.toLowerCase()}-${id}`, category, description, input, expected: { decision, reasonCode } };
}

export function buildBtc15mValueSnipeSystemSimulationMatrix(
  venue: Btc15mValueSnipeVenue,
): Btc15mValueSnipeSimulationScenario[] {
  return [
    scenario(venue, 'positive-edge', 'VALUE_EDGE', 'A discounted ask with explicit all-in cost passes.', () => {}, 'ELIGIBLE', 'ENTRY_READY'),
    scenario(venue, 'edge-too-small', 'VALUE_EDGE', 'An explicit all-in cost above fair probability waits.', (input) => { input.estimatedAllInCost = 0.96; }, 'WAIT', 'VALUE_EDGE_TOO_SMALL'),
    scenario(venue, 'invalid-all-in-cost', 'VALUE_EDGE', 'An all-in cost below the executable limit fails closed.', (input) => { input.estimatedAllInCost = 0.8; }, 'SKIP', 'ALL_IN_COST_INVALID'),
    scenario(venue, 'oracle-stale', 'DATA_QUALITY', 'A stale settlement-price adapter fails closed.', (input) => { input.snapshot.chainlink.fresh = false; }, 'SKIP', 'CHAINLINK_STALE'),
    scenario(venue, 'orderbook-stale', 'DATA_QUALITY', 'A stale order book fails closed.', (input) => { input.snapshot.orderbook.fresh = false; }, 'SKIP', 'ORDERBOOK_STALE'),
    scenario(venue, 'settlement-unconfirmed', 'DATA_QUALITY', 'Unconfirmed settlement metadata fails closed.', (input) => { if (input.snapshot.round) input.snapshot.round.settlementSourceOk = false; }, 'SKIP', 'SETTLEMENT_SOURCE_UNCONFIRMED'),
    scenario(venue, 'price-model-mismatch', 'DATA_QUALITY', 'The wrong venue settlement model fails closed.', (input) => {
      const wrong = venue === 'PREDICT_FUN'
        ? { kind: 'chainlink-spot' as const, asset: 'BTC', windowSeconds: null, configId: null }
        : { kind: 'binance' as const, asset: 'BTC', windowSeconds: null, configId: null };
      if (input.snapshot.round) input.snapshot.round.resolutionPriceModel = wrong;
      input.snapshot.chainlink.priceModel = wrong;
    }, 'SKIP', 'VENUE_PRICE_MODEL_MISMATCH'),
    scenario(venue, 'liquidity-low', 'MARKET_GATES', 'Venue liquidity below its configured floor blocks entry.', (input) => { if (input.snapshot.round) input.snapshot.round.liquidityClob = 1; }, 'SKIP', 'LIQUIDITY_TOO_LOW'),
    scenario(venue, 'spread-wide', 'MARKET_GATES', 'A spread above the hard cap blocks entry.', (input) => { input.snapshot.orderbook = { ...input.snapshot.orderbook, bestAsk: 0.93, bestBid: 0.9, spread: 0.03 }; input.estimatedAllInCost = 0.935; }, 'SKIP', 'SPREAD_TOO_WIDE'),
    scenario(venue, 'after-window', 'MARKET_GATES', 'Entry after the recurring-round window is blocked.', (input) => { input.snapshot.nowSec = 1_800_000_898; }, 'SKIP', 'AFTER_ENTRY_WINDOW'),
  ];
}

export function runBtc15mValueSnipeSystemSimulationMatrix(
  matrix: readonly Btc15mValueSnipeSimulationScenario[] = [
    ...buildBtc15mValueSnipeSystemSimulationMatrix('POLYMARKET'),
    ...buildBtc15mValueSnipeSystemSimulationMatrix('PREDICT_FUN'),
  ],
): Btc15mValueSnipeSimulationRowResult[] {
  return matrix.map((row) => {
    const decision = decideBtc15mValueSnipeEntry(row.input);
    const mismatches: string[] = [];
    if (decision.decision !== row.expected.decision) mismatches.push(`decision:${decision.decision}`);
    if (decision.reasonCode !== row.expected.reasonCode) mismatches.push(`reason:${decision.reasonCode}`);
    return { scenarioId: row.id, category: row.category, decision, passed: mismatches.length === 0, mismatches };
  });
}
