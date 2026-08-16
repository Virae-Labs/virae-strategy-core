import {
  DEFAULT_MUSK_TWEET_STRATEGY_CONFIG,
  MUSK_TWEET_COUNT_STRATEGY_MANIFEST,
  decideMuskTweetCountEntry,
  type MuskTweetSnapshot,
} from '../../src/musk-tweet-count';

const nowSec = 2_000_000_000;
const nowIso = new Date(nowSec * 1_000).toISOString();

function snapshot(): MuskTweetSnapshot {
  return {
    id: 'musk-integration-snapshot',
    capturedAt: nowIso,
    market: {
      eventSlug: 'musk-integration',
      title: 'Musk integration market',
      startAt: nowIso,
      endAt: new Date((nowSec + 21_600) * 1_000).toISOString(),
      status: 'active',
      ranges: [
        { label: '<40', minInclusive: 0, maxInclusive: 39, yesTokenId: 'low-yes', noTokenId: 'low-no' },
        { label: '90-114', minInclusive: 90, maxInclusive: 114, yesTokenId: 'high-yes', noTokenId: 'high-no' },
      ],
    },
    counter: { count: 39, source: 'xtracker', fresh: true, updatedAt: nowIso },
    rates: { rate30m: 0, rate60m: 0, rate2h: 1, rate6h: 1, rate24h: 1, cooldownHours: 0, eventFactor: 'normal' },
    remainingHours: 6,
    orderbooks: [
      { tokenId: 'low-no', minOrderSize: 0.5, bestBid: 0.94, bestAsk: 0.95, spread: 0.01, topDepthUsd: 100, fresh: true, source: 'REST' },
      { tokenId: 'high-no', minOrderSize: 0.5, bestBid: 0.94, bestAsk: 0.95, spread: 0.01, topDepthUsd: 100, fresh: true, source: 'REST' },
    ],
    diagnostics: [],
  };
}

describe('Musk tweet-count installed-host contract', () => {
  it('turns a normalized fresh snapshot into a deterministic bounded intent', () => {
    const input = snapshot();
    const first = decideMuskTweetCountEntry({
      currentSnapshot: input,
      config: DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry,
      nowSec,
    });
    const replay = decideMuskTweetCountEntry({
      currentSnapshot: input,
      config: DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry,
      nowSec,
    });

    expect(MUSK_TWEET_COUNT_STRATEGY_MANIFEST).toMatchObject({ modelVersion: 'musk-live-v2', executionPolicyVersion: 2 });
    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      reasonCode: 'CURRENT_MARKET_INTENT',
      selectedIntent: {
        strategy: 'TAIL_NO_LOW',
        tokenId: 'low-no',
        amount: 187.5,
        limitPrice: 0.95,
        status: 'generated',
      },
    });
  });

  it('never emits an executable intent from a stale orderbook replay', () => {
    const input = snapshot();
    input.orderbooks = input.orderbooks.map((quote) => ({ ...quote, fresh: false }));
    const decision = decideMuskTweetCountEntry({
      currentSnapshot: input,
      config: DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry,
      nowSec,
    });

    expect(decision.reasonCode).toBe('CURRENT_MARKET_REJECTED');
    expect(decision.currentEvaluation?.intents).toEqual([]);
    expect(decision.selectedIntent).toMatchObject({ status: 'rejected', rejectionReason: 'ORDERBOOK_STALE' });
  });
});
