import * as root from '../../src';
import * as subpath from '../../src/crypto-tail';
import * as preMarket from '../../src/pre-market';
import * as muskTweetCount from '../../src/musk-tweet-count';
import * as weatherTemperature from '../../src/weather-temperature';
import * as hitPriceSnipe from '../../src/hit-price-snipe';
import * as btc15mValueSnipe from '../../src/btc15m-value-snipe';
import * as memecoinMomentumGuard from '../../src/memecoin-momentum-guard';

describe('public API contract', () => {
  it('exports the generic strategy surface from root and subpath entry points', () => {
    const names = [
      'buildCryptoTailEntryExecutionPlan',
      'buildCryptoTailGateDiagnostics',
      'createCryptoTailLifecycleState',
      'decideCryptoTailEntry',
      'evaluateCryptoTailChase',
      'evaluateCryptoTailExit',
      'reduceCryptoTailLifecycle',
      'CRYPTO_TAIL_STRATEGY_MANIFEST',
      'REFERENCE_CRYPTO_TAIL_CONFIG_V1',
    ] as const;

    for (const name of names) {
      expect(root[name]).toBeDefined();
      expect(root[name]).toBe(subpath[name]);
    }
  });

  it('keeps manifest identity explicit and serializable', () => {
    expect(root.CRYPTO_TAIL_STRATEGY_MANIFEST).toEqual({
      id: 'crypto-tail-directional',
      modelVersion: 'heuristic-v3-twap',
      inputSchemaVersion: 2,
      executionPolicyVersion: 2,
      supportedAssets: ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'BNB'],
      supportedIntervals: ['15m', '1h'],
    });
    expect(JSON.parse(JSON.stringify(root.CRYPTO_TAIL_STRATEGY_MANIFEST)))
      .toEqual(root.CRYPTO_TAIL_STRATEGY_MANIFEST);
  });

  it('retains compatibility aliases without a second implementation', () => {
    expect(root.decideBtc15mTailEntry).toBe(root.decideCryptoTailEntry);
    expect(root.buildBtc15mGateDiagnostics).toBe(root.buildCryptoTailGateDiagnostics);
    expect(root.estimateBtc15mAllInCost).toBe(root.estimateCryptoTailAllInCost);
    expect(root.estimateBtc15mWinProbability).toBe(root.estimateCryptoTailWinProbability);
  });

  it('derives every hosted Crypto Tail profile from the manifest registry', () => {
    expect(root.CRYPTO_TAIL_PROFILE_KEYS).toEqual([
      'btc-15m-tail', 'eth-15m-tail', 'sol-15m-tail', 'doge-15m-tail', 'xrp-15m-tail', 'bnb-15m-tail',
      'btc-1h-tail', 'eth-1h-tail', 'sol-1h-tail', 'doge-1h-tail', 'xrp-1h-tail', 'bnb-1h-tail',
    ]);
    expect(root.VIRAE_STRATEGY_CORE_CATALOG[0].autoTradeStrategyKeys)
      .toBe(root.CRYPTO_TAIL_PROFILE_KEYS);
  });

  it('exports the Pre-M strategy surface from root and its focused subpath', () => {
    const names = [
      'buildPreMarketEntryPlan',
      'buildPreMarketTakeProfitIntents',
      'normalizePreMarketStrategyConfig',
      'preMarketPricesForMode',
      'PRE_MARKET_STRATEGY_MANIFEST',
      'DEFAULT_PRE_MARKET_STRATEGY_CONFIG',
    ] as const;
    for (const name of names) {
      expect(root[name]).toBeDefined();
      expect(root[name]).toBe(preMarket[name]);
    }
    expect(JSON.parse(JSON.stringify(root.PRE_MARKET_STRATEGY_MANIFEST)))
      .toEqual(root.PRE_MARKET_STRATEGY_MANIFEST);
  });

  it('exports the Musk tweet-count surface from root and its focused subpath', () => {
    const names = [
      'decideMuskTweetCountEntry',
      'evaluateMuskTweetStrategy',
      'evaluateMuskTweetNextMarketPreposition',
      'normalizeMuskTweetStrategyConfig',
      'selectMuskEvaluationSnapshots',
      'MUSK_TWEET_COUNT_STRATEGY_MANIFEST',
      'DEFAULT_MUSK_TWEET_STRATEGY_CONFIG',
    ] as const;
    for (const name of names) {
      expect(root[name]).toBeDefined();
      expect(root[name]).toBe(muskTweetCount[name]);
    }
    expect(root.DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry.maxNotionalUsd).toBe(1_000);
    expect(root.MUSK_TWEET_COUNT_STRATEGY_MANIFEST).toMatchObject({
      modelVersion: 'musk-live-v2',
      executionPolicyVersion: 2,
    });
  });

  it('exports the Weather Temperature surface from root and its focused subpath', () => {
    const names = [
      'decideWeatherTemperatureEntry',
      'evaluateWeatherTemperatureCandidate',
      'normalizeWeatherTemperatureStrategyConfig',
      'WEATHER_TEMPERATURE_STRATEGY_MANIFEST',
      'DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG',
      'WEATHER_TEMPERATURE_SIGNAL_PROFILES',
      'WEATHER_TEMPERATURE_CONFIG_VERSION',
    ] as const;
    for (const name of names) {
      expect(root[name]).toBeDefined();
      expect(root[name]).toBe(weatherTemperature[name]);
    }
    expect(root.WEATHER_TEMPERATURE_CONFIG_VERSION).toBe('weather-gfs-v3');
    expect(root.WEATHER_TEMPERATURE_SIGNAL_PROFILES).toHaveLength(3);
  });

  it('exports the Hit Price Snipe surface from root and its focused subpath', () => {
    const names = [
      'decideHitPriceSnipeEntry',
      'estimateHitPriceSnipeNetEdgeBps',
      'buildHitPriceSnipeSystemSimulationMatrix',
      'runHitPriceSnipeSystemSimulationMatrix',
      'simulateHitPriceSnipeFill',
      'normalizeHitPriceSnipeStrategyConfig',
      'HIT_PRICE_SNIPE_STRATEGY_MANIFEST',
      'DEFAULT_HIT_PRICE_SNIPE_STRATEGY_CONFIG',
    ] as const;
    for (const name of names) {
      expect(root[name]).toBeDefined();
      expect(root[name]).toBe(hitPriceSnipe[name]);
    }
    expect(root.HIT_PRICE_SNIPE_STRATEGY_MANIFEST).toMatchObject({
      modelVersion: 'hit-price-snipe-simulation-v1',
      executionPhase: 'HOST_EXECUTION_SUPPORTED',
    });
  });

  it('exports the venue-aware BTC 15m Value Snipe surface', () => {
    const names = [
      'decideBtc15mValueSnipeEntry',
      'buildBtc15mValueSnipeSystemSimulationMatrix',
      'runBtc15mValueSnipeSystemSimulationMatrix',
      'normalizeBtc15mValueSnipeConfig',
      'BTC15M_VALUE_SNIPE_STRATEGY_MANIFEST',
      'DEFAULT_BTC15M_VALUE_SNIPE_CONFIG',
    ] as const;
    for (const name of names) {
      expect(root[name]).toBeDefined();
      expect(root[name]).toBe(btc15mValueSnipe[name]);
    }
    expect(root.BTC15M_VALUE_SNIPE_STRATEGY_MANIFEST).toMatchObject({
      executionPhase: 'HOST_EXECUTION_SUPPORTED',
      supportedVenues: ['POLYMARKET', 'PREDICT_FUN'],
    });
    expect(root.runBtc15mValueSnipeSystemSimulationMatrix()).toHaveLength(20);
  });

  it('exports the Memecoin Momentum Guard surface', () => {
    const names = [
      'decideMemecoinMomentumEntry',
      'decideMemecoinMomentumExit',
      'buildMemecoinMomentumGuardSimulationMatrix',
      'runMemecoinMomentumGuardSimulationMatrix',
      'MEMECOIN_MOMENTUM_GUARD_STRATEGY_MANIFEST',
      'DEFAULT_MEMECOIN_MOMENTUM_GUARD_CONFIG',
    ] as const;
    for (const name of names) {
      expect(root[name]).toBeDefined();
      expect(root[name]).toBe(memecoinMomentumGuard[name]);
    }
    expect(root.MEMECOIN_MOMENTUM_GUARD_STRATEGY_MANIFEST).toMatchObject({
      executionPhase: 'HOST_EXECUTION_SUPPORTED',
      supportedVenues: ['SOLANA'],
    });
    expect(root.runMemecoinMomentumGuardSimulationMatrix()).toHaveLength(15);
  });

  it('publishes a serializable strategy catalog without execution capabilities', () => {
    expect(root.VIRAE_STRATEGY_CORE_CATALOG).toEqual([
      expect.objectContaining({
        key: 'crypto-tail',
        module: 'crypto-tail',
        autoTradeStrategyKeys: [
          'btc-15m-tail', 'eth-15m-tail', 'sol-15m-tail', 'doge-15m-tail', 'xrp-15m-tail', 'bnb-15m-tail',
          'btc-1h-tail', 'eth-1h-tail', 'sol-1h-tail', 'doge-1h-tail', 'xrp-1h-tail', 'bnb-1h-tail',
        ],
        manifest: root.CRYPTO_TAIL_STRATEGY_MANIFEST,
      }),
      expect.objectContaining({
        key: 'pre-market',
        module: 'pre-market',
        autoTradeStrategyKeys: ['btc-15m-premarket'],
        manifest: root.PRE_MARKET_STRATEGY_MANIFEST,
      }),
      expect.objectContaining({
        key: 'musk-tweet-count',
        module: 'musk-tweet-count',
        autoTradeStrategyKeys: ['musk-tweet-count'],
        manifest: root.MUSK_TWEET_COUNT_STRATEGY_MANIFEST,
      }),
      expect.objectContaining({
        key: 'weather-temperature',
        module: 'weather-temperature',
        autoTradeStrategyKeys: ['weather-temperature'],
        manifest: root.WEATHER_TEMPERATURE_STRATEGY_MANIFEST,
      }),
      expect.objectContaining({
        key: 'hit-price-snipe',
        module: 'hit-price-snipe',
        autoTradeStrategyKeys: ['hit-price-snipe'],
        manifest: root.HIT_PRICE_SNIPE_STRATEGY_MANIFEST,
      }),
      expect.objectContaining({
        key: 'btc15m-value-snipe',
        module: 'btc15m-value-snipe',
        autoTradeStrategyKeys: ['btc15m-value-snipe'],
        manifest: root.BTC15M_VALUE_SNIPE_STRATEGY_MANIFEST,
      }),
      expect.objectContaining({
        key: 'memecoin-momentum-guard',
        module: 'memecoin-momentum-guard',
        autoTradeStrategyKeys: ['memecoin-momentum-guard'],
        manifest: root.MEMECOIN_MOMENTUM_GUARD_STRATEGY_MANIFEST,
      }),
      expect.objectContaining({
        key: 'memecoin-launch-scout',
        module: 'memecoin-launch-scout',
        autoTradeStrategyKeys: ['memecoin-launch-scout'],
        manifest: root.MEMECOIN_LAUNCH_SCOUT_STRATEGY_MANIFEST,
      }),
    ]);
    for (const strategy of root.VIRAE_STRATEGY_CORE_CATALOG) {
      expect(strategy.capabilities).toMatchObject({
        decision: true,
        replay: true,
        networkAccess: false,
        orderSubmission: false,
      });
    }
    expect(root.VIRAE_STRATEGY_CORE_CATALOG.find(({ key }) => key === 'hit-price-snipe')?.capabilities.orderIntents).toBe(true);
    expect(root.VIRAE_STRATEGY_CORE_CATALOG.find(({ key }) => key === 'btc15m-value-snipe')?.capabilities.orderIntents).toBe(false);
    expect(root.VIRAE_STRATEGY_CORE_CATALOG.find(({ key }) => key === 'memecoin-momentum-guard')?.capabilities.orderIntents).toBe(false);
    expect(root.VIRAE_STRATEGY_CORE_CATALOG.find(({ key }) => key === 'memecoin-launch-scout')?.capabilities.orderIntents).toBe(false);
    expect(JSON.parse(JSON.stringify(root.VIRAE_STRATEGY_CORE_CATALOG)))
      .toEqual(root.VIRAE_STRATEGY_CORE_CATALOG);
  });
});
