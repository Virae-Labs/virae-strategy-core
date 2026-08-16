import * as root from '../../src';
import * as subpath from '../../src/crypto-tail';

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
});
