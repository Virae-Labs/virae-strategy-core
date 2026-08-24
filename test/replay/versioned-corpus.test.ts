import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CRYPTO_TAIL_STRATEGY_MANIFEST, decideCryptoTailEntry } from '../../src/crypto-tail';
import type { CryptoTailDecisionInput, CryptoTailDecisionResult } from '../../src/crypto-tail';

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
});
