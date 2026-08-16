import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectMetadata = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
const tempRoot = mkdtempSync(join(tmpdir(), 'virae-strategy-core-e2e-'));
const consumerRoot = join(tempRoot, 'consumer');

function run(command, args, cwd, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    throw new Error([
      `${command} ${args.join(' ')} failed with exit ${result.status}`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n'));
  }
  return result.stdout;
}

try {
  const packOutput = run('npm', [
    'pack',
    '--json',
    '--ignore-scripts',
    '--pack-destination',
    tempRoot,
  ], projectRoot, {
    npm_config_cache: join(tempRoot, 'pack-cache'),
  });
  const packData = JSON.parse(packOutput);
  assert.equal(packData.length, 1);

  const tarball = join(tempRoot, packData[0].filename);
  assert.ok(existsSync(tarball), 'npm pack did not create a tarball');
  const packedPaths = new Set(packData[0].files.map((file) => file.path));
  for (const required of [
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
    'dist/index.js',
    'dist/index.d.ts',
    'dist/crypto-tail/index.js',
    'dist/crypto-tail/index.d.ts',
    'docs/strategy/crypto-tail.md',
    'docs/integration.md',
    'examples/decision-and-plan.cjs',
  ]) {
    assert.ok(packedPaths.has(required), `missing packed file: ${required}`);
  }
  assert.ok(![...packedPaths].some((path) => path.startsWith('src/')), 'source files leaked into package');
  assert.ok(![...packedPaths].some((path) => path.includes('__tests__')), 'tests leaked into package');

  mkdirSync(consumerRoot, { recursive: true });
  writeFileSync(join(consumerRoot, 'package.json'), JSON.stringify({
    name: 'strategy-core-e2e-consumer',
    version: '1.0.0',
    private: true,
    type: 'commonjs',
  }, null, 2));
  run('npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--save-exact',
    tarball,
  ], consumerRoot, {
    npm_config_cache: join(tempRoot, 'consumer-cache'),
  });

  writeFileSync(join(consumerRoot, 'consumer.cjs'), `
const assert = require('node:assert/strict');
const root = require('@viraeai/virae-strategy-core');
const subpath = require('@viraeai/virae-strategy-core/crypto-tail');
const metadata = require('@viraeai/virae-strategy-core/package.json');
assert.equal(metadata.name, '@viraeai/virae-strategy-core');
assert.equal(metadata.version, '${projectMetadata.version}');
assert.equal(root.decideCryptoTailEntry, subpath.decideCryptoTailEntry);
assert.equal(root.CRYPTO_TAIL_STRATEGY_MANIFEST.executionPolicyVersion, 1);
`);
  run(process.execPath, ['consumer.cjs'], consumerRoot);

  writeFileSync(join(consumerRoot, 'consumer.mjs'), `
import assert from 'node:assert/strict';
import * as root from '@viraeai/virae-strategy-core';
import * as subpath from '@viraeai/virae-strategy-core/crypto-tail';
assert.equal(typeof root.decideCryptoTailEntry, 'function');
assert.equal(typeof subpath.buildCryptoTailEntryExecutionPlan, 'function');
`);
  run(process.execPath, ['consumer.mjs'], consumerRoot);

  writeFileSync(join(consumerRoot, 'consumer.ts'), `
import {
  CRYPTO_TAIL_STRATEGY_MANIFEST,
  decideCryptoTailEntry,
  type CryptoTailDecisionInput,
} from '@viraeai/virae-strategy-core/crypto-tail';
const input = null as unknown as CryptoTailDecisionInput;
if (input) decideCryptoTailEntry(input);
const policyVersion: number = CRYPTO_TAIL_STRATEGY_MANIFEST.executionPolicyVersion;
void policyVersion;
`);
  const tsc = join(projectRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
  for (const [name, moduleResolution, module] of [
    ['classic', 'node', 'CommonJS'],
    ['node16', 'Node16', 'Node16'],
  ]) {
    const configPath = join(consumerRoot, `tsconfig.${name}.json`);
    writeFileSync(configPath, JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module,
        moduleResolution,
        strict: true,
        noEmit: true,
        skipLibCheck: false,
      },
      files: ['consumer.ts'],
    }, null, 2));
    run(tsc, ['-p', configPath], consumerRoot);
  }

  const installedMetadata = JSON.parse(readFileSync(
    join(consumerRoot, 'node_modules', '@viraeai', 'virae-strategy-core', 'package.json'),
    'utf8',
  ));
  assert.equal(installedMetadata.sideEffects, false);
  assert.deepEqual(readdirSync(join(consumerRoot, 'node_modules', '@viraeai', 'virae-strategy-core', 'dist')).sort(), [
    'crypto-tail',
    'index.d.ts',
    'index.d.ts.map',
    'index.js',
    'index.js.map',
  ]);

  console.log(`e2e consumer verified ${installedMetadata.name}@${installedMetadata.version}`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
