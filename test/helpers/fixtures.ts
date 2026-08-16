import { REFERENCE_CRYPTO_TAIL_CONFIG_V1 } from '../../src/crypto-tail/reference';
import type { CryptoTailDecisionInput } from '../../src/crypto-tail/types';

export function eligibleCryptoTailInput(): CryptoTailDecisionInput {
  const nowSec = 1_800_000_880;
  return {
    nowSec,
    round: {
      roundKey: 'btc-updown-15m-1800000000',
      eventSlug: 'btc-updown-15m-1800000000',
      eventTitle: null,
      eventImage: null,
      eventIcon: null,
      marketId: 'market-1',
      marketQuestion: null,
      marketImage: null,
      marketIcon: null,
      upTokenId: 'up-token',
      downTokenId: 'down-token',
      upOutcomeLabel: 'Up',
      downOutcomeLabel: 'Down',
      roundStartSec: 1_800_000_000,
      roundEndSec: 1_800_000_900,
      priceToBeat: 100_000,
      priceToBeatSource: 'chainlink',
      resolutionPriceModel: {
        kind: 'chainlink-twap',
        asset: 'BTC',
        windowSeconds: 60,
        configId: null,
      },
      active: true,
      closed: false,
      acceptingOrders: true,
      enableOrderBook: true,
      orderMinSize: 5,
      liquidityClob: 20_000,
      settlementSourceOk: true,
      metadataFresh: true,
    },
    chainlink: {
      startPrice: 100_000,
      currentPrice: 100_120,
      currentPointTs: nowSec,
      fresh: true,
      priceModel: null,
    },
    orderbook: {
      bestAsk: 0.92,
      bestBid: 0.915,
      spread: 0.005,
      topDepthUsd: 100,
      tickSize: 0.01,
      fresh: true,
    },
    config: {
      ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
      entry: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
        directionFlipStopEnabled: true,
      },
    },
    risk: {
      dailyLossUsd: 0,
      taskNetLossUsd: 0,
      consecutiveLosses: 0,
      tradesToday: 0,
      hasRoundExecution: false,
    },
    global: {
      enabled: true,
      liveTradingEnabled: true,
      maxNotionalUsd: null,
    },
  };
}
