import * as root from '../../src';
import * as subpath from '../../src/crypto-tail';
import * as preMarket from '../../src/pre-market';

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
      modelVersion: 'heuristic-v2-twap',
      inputSchemaVersion: 1,
      executionPolicyVersion: 1,
      supportedAssets: ['BTC', 'ETH'],
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

  it('publishes a serializable strategy catalog without execution capabilities', () => {
    expect(root.VIRAE_STRATEGY_CORE_CATALOG).toEqual([
      expect.objectContaining({
        key: 'crypto-tail',
        module: 'crypto-tail',
        autoTradeStrategyKeys: ['btc-15m-tail', 'eth-15m-tail', 'btc-1h-tail', 'eth-1h-tail'],
        manifest: root.CRYPTO_TAIL_STRATEGY_MANIFEST,
      }),
      expect.objectContaining({
        key: 'pre-market',
        module: 'pre-market',
        autoTradeStrategyKeys: ['btc-15m-premarket'],
        manifest: root.PRE_MARKET_STRATEGY_MANIFEST,
      }),
    ]);
    for (const strategy of root.VIRAE_STRATEGY_CORE_CATALOG) {
      expect(strategy.capabilities).toMatchObject({
        decision: true,
        orderIntents: true,
        replay: true,
        networkAccess: false,
        orderSubmission: false,
      });
    }
    expect(JSON.parse(JSON.stringify(root.VIRAE_STRATEGY_CORE_CATALOG)))
      .toEqual(root.VIRAE_STRATEGY_CORE_CATALOG);
  });
});
