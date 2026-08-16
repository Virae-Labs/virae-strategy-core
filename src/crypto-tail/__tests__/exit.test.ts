import { evaluateCryptoTailExit } from '../exit';

const oracle = {
  startPrice: 100_000,
  currentPrice: 100_120,
  currentPointTs: 100,
  fresh: true,
  priceModel: null,
};

describe('evaluateCryptoTailExit', () => {
  it('exits an Up position after the reference direction flips', () => {
    expect(evaluateCryptoTailExit({
      position: { outcome: 'Up', entryDistanceBps: 12 },
      policy: { directionFlipEnabled: true, distanceCollapsePercent: null },
      oracle: { ...oracle, currentPrice: 99_990 },
      roundEndSec: 120,
      nowSec: 100,
    })).toMatchObject({ shouldExit: true, reasonCode: 'DIRECTION_FLIPPED' });
  });

  it('exits when the signal distance collapses below the configured fraction', () => {
    expect(evaluateCryptoTailExit({
      position: { outcome: 'Up', entryDistanceBps: 20 },
      policy: { directionFlipEnabled: false, distanceCollapsePercent: 40 },
      oracle: { ...oracle, currentPrice: 100_005 },
      roundEndSec: 120,
      nowSec: 100,
    })).toMatchObject({ shouldExit: true, reasonCode: 'DISTANCE_COLLAPSED' });
  });

  it('fails closed when the oracle is stale', () => {
    expect(evaluateCryptoTailExit({
      position: { outcome: 'Up', entryDistanceBps: 20 },
      policy: { directionFlipEnabled: true, distanceCollapsePercent: 40 },
      oracle: { ...oracle, fresh: false },
      roundEndSec: 120,
      nowSec: 100,
    })).toMatchObject({ shouldExit: false, reasonCode: 'CHAINLINK_UNAVAILABLE' });
  });

  it('does not create a price exit after the round has ended', () => {
    expect(evaluateCryptoTailExit({
      position: { outcome: 'Up', entryDistanceBps: 20 },
      policy: { directionFlipEnabled: true, distanceCollapsePercent: 40 },
      oracle,
      roundEndSec: 100,
      nowSec: 100,
    })).toEqual({
      shouldExit: false,
      reasonCode: 'ROUND_ENDED',
      reasonMessage: 'Round has already ended.',
      distanceBps: null,
      currentDelta: null,
      secondsToEnd: 0,
    });
  });

  it('fails closed when an oracle price is missing', () => {
    expect(evaluateCryptoTailExit({
      position: { outcome: 'Down', entryDistanceBps: 20 },
      policy: { directionFlipEnabled: true, distanceCollapsePercent: 40 },
      oracle: { ...oracle, currentPrice: null },
      roundEndSec: 120,
      nowSec: 100,
    })).toMatchObject({ shouldExit: false, reasonCode: 'CHAINLINK_UNAVAILABLE' });
  });

  it('exits a Down position when the reference direction returns to Up', () => {
    expect(evaluateCryptoTailExit({
      position: { outcome: 'Down', entryDistanceBps: 20 },
      policy: { directionFlipEnabled: true, distanceCollapsePercent: null },
      oracle: { ...oracle, currentPrice: 100_001 },
      roundEndSec: 120,
      nowSec: 100,
    })).toMatchObject({ shouldExit: true, reasonCode: 'DIRECTION_FLIPPED', currentDelta: 1 });
  });

  it('holds when enabled exit conditions are not met', () => {
    expect(evaluateCryptoTailExit({
      position: { outcome: 'Up', entryDistanceBps: 10 },
      policy: { directionFlipEnabled: true, distanceCollapsePercent: 40 },
      oracle,
      roundEndSec: 120,
      nowSec: 100,
    })).toMatchObject({ shouldExit: false, reasonCode: 'POSITION_HELD', currentDelta: 120 });
  });
});
