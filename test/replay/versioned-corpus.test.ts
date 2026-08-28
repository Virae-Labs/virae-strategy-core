import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CRYPTO_TAIL_STRATEGY_MANIFEST, decideCryptoTailEntry } from '../../src/crypto-tail';
import type { CryptoTailDecisionInput, CryptoTailDecisionResult } from '../../src/crypto-tail';
import { runHitPriceSnipeSystemSimulationMatrix } from '../../src/hit-price-snipe';
import { runBtc15mValueSnipeSystemSimulationMatrix } from '../../src/btc15m-value-snipe';
import { runMemecoinMomentumGuardSimulationMatrix } from '../../src/memecoin-momentum-guard';

type JsonRecord = Record<string, unknown>;

function merge(base: unknown, patch: unknown): unknown {
  if (!base || typeof base !== 'object' || Array.isArray(base)
    || !patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const result: JsonRecord = { ...(base as JsonRecord) };
  for (const [key, value] of Object.entries(patch as JsonRecord)) {
    result[key] = key in result ? merge(result[key], value) : value;
  }
  return result;
}

describe('versioned replay corpus', () => {
  it('keeps the Crypto Tail 0.7.0 safety decisions stable', () => {
    const corpus = JSON.parse(readFileSync(
      resolve(__dirname, '../../fixtures/replay/crypto-tail-safety-v0.7.0.json'),
      'utf8',
    )) as {
      manifest: typeof CRYPTO_TAIL_STRATEGY_MANIFEST;
      baseInput: CryptoTailDecisionInput;
      cases: Array<{
        id: string;
        overrides: JsonRecord;
        expected: Partial<CryptoTailDecisionResult>;
      }>;
    };
    expect(corpus.manifest).toMatchObject({
      modelVersion: CRYPTO_TAIL_STRATEGY_MANIFEST.modelVersion,
      inputSchemaVersion: CRYPTO_TAIL_STRATEGY_MANIFEST.inputSchemaVersion,
      executionPolicyVersion: CRYPTO_TAIL_STRATEGY_MANIFEST.executionPolicyVersion,
    });
    for (const fixture of corpus.cases) {
      const input = merge(corpus.baseInput, fixture.overrides) as CryptoTailDecisionInput;
      expect(decideCryptoTailEntry(input)).toMatchObject(fixture.expected);
    }
  });

  it('keeps the canonical Snipe 0.8.0 matrix decisions stable', () => {
    const corpus = JSON.parse(readFileSync(
      resolve(__dirname, '../../fixtures/replay/snipe-system-v0.8.0.json'),
      'utf8',
    )) as {
      packageVersion: string;
      matrices: Record<string, Array<[string, string, string]>>;
    };
    expect(corpus.packageVersion).toBe('0.8.0');
    const compact = (rows: ReturnType<typeof runHitPriceSnipeSystemSimulationMatrix>
      | ReturnType<typeof runBtc15mValueSnipeSystemSimulationMatrix>) => rows.map((row) => [
      row.scenarioId,
      row.decision.decision,
      row.decision.reasonCode,
    ]);
    expect(compact(runHitPriceSnipeSystemSimulationMatrix()))
      .toEqual(corpus.matrices['hit-price-snipe']);
    expect(compact(runBtc15mValueSnipeSystemSimulationMatrix()))
      .toEqual(corpus.matrices['btc15m-value-snipe']);
  });

  it('keeps the Memecoin Momentum Guard 0.13.0 matrix decisions stable', () => {
    const corpus = JSON.parse(readFileSync(
      resolve(__dirname, '../../fixtures/replay/memecoin-momentum-guard-v0.13.0.json'),
      'utf8',
    )) as { packageVersion: string; matrix: Array<[string, string, string]> };
    expect(corpus.packageVersion).toBe('0.13.0');
    expect(runMemecoinMomentumGuardSimulationMatrix().map((row) => [
      row.scenarioId,
      row.decision.decision,
      row.decision.reasonCode,
    ])).toEqual(corpus.matrix);
  });
});
