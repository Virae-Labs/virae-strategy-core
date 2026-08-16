import {
  buildPreMarketEntryPlan,
  buildPreMarketTakeProfitIntents,
  PRE_MARKET_STRATEGY_MANIFEST,
} from '../../src/pre-market';

describe('Pre-M entry-to-take-profit flow', () => {
  it('plans both ladders and converts reconciled partial fills into one exit per outcome', () => {
    const round = {
      roundKey: 'btc-updown-15m-1800000000',
      roundStartSec: 1_800_000_000,
      roundEndSec: 1_800_000_900,
      nowSec: 1_799_999_760,
      marketActive: true,
      acceptingOrders: true,
      upTokenId: 'up-token',
      downTokenId: 'down-token',
    };
    const entry = buildPreMarketEntryPlan({ round, config: { mode: 'SAFE' } });
    expect(entry.ok).toBe(true);
    if (!entry.ok) return;

    const fills = entry.intents.slice(0, 2).map((intent, index) => ({
      outcome: intent.outcome,
      tokenId: intent.tokenId,
      filledShares: index === 0 ? 2 : 1,
      filledNotionalUsd: index === 0 ? 0.72 : 0.27,
      bestAsk: 0.61,
    }));
    const exits = buildPreMarketTakeProfitIntents({
      roundKey: round.roundKey,
      roundStartSec: round.roundStartSec,
      nowSec: round.roundStartSec + 300,
      positions: fills,
    });

    expect(PRE_MARKET_STRATEGY_MANIFEST.modelVersion).toBe('pre-m-live-v1');
    expect(entry.intents).toHaveLength(12);
    expect(exits).toEqual([expect.objectContaining({
      intentKey: `${round.roundKey}:TAKE_PROFIT:UP`,
      tokenId: 'up-token',
      shares: 3,
      price: 0.66,
    })]);
  });
});
