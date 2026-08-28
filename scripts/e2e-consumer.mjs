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
    'dist/pre-market/index.js',
    'dist/pre-market/index.d.ts',
    'dist/musk-tweet-count/index.js',
    'dist/musk-tweet-count/index.d.ts',
    'dist/weather-temperature/index.js',
    'dist/weather-temperature/index.d.ts',
    'dist/hit-price-snipe/index.js',
    'dist/hit-price-snipe/index.d.ts',
    'dist/btc15m-value-snipe/index.js',
    'dist/btc15m-value-snipe/index.d.ts',
    'dist/memecoin-momentum-guard/index.js',
    'dist/memecoin-momentum-guard/index.d.ts',
    'dist/memecoin-launch-scout/index.js',
    'dist/memecoin-launch-scout/index.d.ts',
    'docs/strategy/musk-tweet-count.md',
    'docs/strategy/crypto-tail.md',
    'docs/strategy/pre-market.md',
    'docs/strategy/weather-temperature.md',
    'docs/strategy/hit-price-snipe.md',
    'docs/strategy/btc15m-value-snipe.md',
    'docs/strategy/memecoin-momentum-guard.md',
    'docs/strategy/memecoin-launch-scout.md',
    'docs/integration.md',
    'examples/decision-and-plan.cjs',
    'fixtures/replay/crypto-tail-safety-v0.7.0.json',
    'fixtures/replay/snipe-system-v0.8.0.json',
    'fixtures/replay/memecoin-momentum-guard-v0.9.0.json',
    'skills/virae-strategy-core/SKILL.md',
    'skills/virae-strategy-core/agents/openai.yaml',
    'skills/virae-strategy-core/scripts/list-strategies.mjs',
    'skills/virae-strategy-core/scripts/evaluate.mjs',
    'skills/virae-strategy-core/scripts/replay.mjs',
    'skills/virae-strategy-core/scripts/runtime.mjs',
    'skills/virae-strategy-core/references/strategy-catalog.md',
    'skills/virae-strategy-core/references/execution-boundary.md',
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
const preMarket = require('@viraeai/virae-strategy-core/pre-market');
const muskTweetCount = require('@viraeai/virae-strategy-core/musk-tweet-count');
const weatherTemperature = require('@viraeai/virae-strategy-core/weather-temperature');
const hitPriceSnipe = require('@viraeai/virae-strategy-core/hit-price-snipe');
const btc15mValueSnipe = require('@viraeai/virae-strategy-core/btc15m-value-snipe');
const memecoinMomentumGuard = require('@viraeai/virae-strategy-core/memecoin-momentum-guard');
const memecoinLaunchScout = require('@viraeai/virae-strategy-core/memecoin-launch-scout');
const metadata = require('@viraeai/virae-strategy-core/package.json');
assert.equal(metadata.name, '@viraeai/virae-strategy-core');
assert.equal(metadata.version, '${projectMetadata.version}');
assert.equal(root.decideCryptoTailEntry, subpath.decideCryptoTailEntry);
assert.equal(root.CRYPTO_TAIL_STRATEGY_MANIFEST.executionPolicyVersion, 2);
assert.equal(root.buildPreMarketEntryPlan, preMarket.buildPreMarketEntryPlan);
assert.equal(preMarket.PRE_MARKET_STRATEGY_MANIFEST.executionPolicyVersion, 1);
assert.equal(root.decideMuskTweetCountEntry, muskTweetCount.decideMuskTweetCountEntry);
assert.equal(muskTweetCount.DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry.maxNotionalUsd, 1000);
assert.equal(root.decideWeatherTemperatureEntry, weatherTemperature.decideWeatherTemperatureEntry);
assert.equal(weatherTemperature.WEATHER_TEMPERATURE_STRATEGY_MANIFEST.modelVersion, 'weather-gfs-v3');
assert.equal(root.runHitPriceSnipeSystemSimulationMatrix, hitPriceSnipe.runHitPriceSnipeSystemSimulationMatrix);
assert.equal(hitPriceSnipe.runHitPriceSnipeSystemSimulationMatrix().every((row) => row.passed), true);
assert.equal(root.runBtc15mValueSnipeSystemSimulationMatrix, btc15mValueSnipe.runBtc15mValueSnipeSystemSimulationMatrix);
assert.equal(btc15mValueSnipe.runBtc15mValueSnipeSystemSimulationMatrix().length, 20);
assert.equal(btc15mValueSnipe.runBtc15mValueSnipeSystemSimulationMatrix().every((row) => row.passed), true);
assert.equal(root.decideMemecoinMomentumEntry, memecoinMomentumGuard.decideMemecoinMomentumEntry);
assert.equal(memecoinMomentumGuard.runMemecoinMomentumGuardSimulationMatrix().length, 15);
assert.equal(memecoinMomentumGuard.runMemecoinMomentumGuardSimulationMatrix().every((row) => row.passed), true);
assert.equal(root.decideMemecoinLaunchEntry, memecoinLaunchScout.decideMemecoinLaunchEntry);
assert.equal(memecoinLaunchScout.runMemecoinLaunchScoutSystemSimulationMatrix().length, 21);
assert.equal(memecoinLaunchScout.runMemecoinLaunchScoutSystemSimulationMatrix().every((row) => row.passed), true);
const nowSec = 2000000000;
const nowIso = new Date(nowSec * 1000).toISOString();
const muskMarket = {
  eventSlug: 'musk-e2e', title: 'Musk E2E', startAt: nowIso,
  endAt: new Date((nowSec + 21600) * 1000).toISOString(), status: 'active',
  ranges: [{ label: '<40', minInclusive: 0, maxInclusive: 39, yesTokenId: 'musk-e2e-yes', noTokenId: 'musk-e2e-no' }],
};
const muskSnapshot = {
  id: 'musk-e2e-snapshot', capturedAt: nowIso, market: muskMarket,
  counter: { count: 39, source: 'xtracker', fresh: true, updatedAt: nowIso },
  rates: { rate30m: 0, rate60m: 0, rate2h: 1, rate6h: 1, rate24h: 1, cooldownHours: 0, eventFactor: 'normal' },
  remainingHours: 6,
  orderbooks: [{ tokenId: 'musk-e2e-no', minOrderSize: 0.5, bestBid: 0.94, bestAsk: 0.95, spread: 0.01, topDepthUsd: 100, fresh: true, source: 'REST' }],
  diagnostics: [],
};
const muskDecision = muskTweetCount.decideMuskTweetCountEntry({
  currentSnapshot: muskSnapshot,
  config: muskTweetCount.DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry,
  nowSec,
});
assert.equal(muskDecision.reasonCode, 'CURRENT_MARKET_INTENT');
assert.equal(muskDecision.selectedIntent.amount, 187.5);
assert.deepEqual(root.VIRAE_STRATEGY_CORE_CATALOG.map(({ key }) => key), ['crypto-tail', 'pre-market', 'musk-tweet-count', 'weather-temperature', 'hit-price-snipe', 'btc15m-value-snipe', 'memecoin-momentum-guard', 'memecoin-launch-scout']);
assert.throws(() => require('@viraeai/virae-strategy-core/ev-snipe'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
`);
  run(process.execPath, ['consumer.cjs'], consumerRoot);

  writeFileSync(join(consumerRoot, 'consumer.mjs'), `
import assert from 'node:assert/strict';
import * as root from '@viraeai/virae-strategy-core';
import * as subpath from '@viraeai/virae-strategy-core/crypto-tail';
import * as preMarket from '@viraeai/virae-strategy-core/pre-market';
import * as muskTweetCount from '@viraeai/virae-strategy-core/musk-tweet-count';
import * as weatherTemperature from '@viraeai/virae-strategy-core/weather-temperature';
import * as hitPriceSnipe from '@viraeai/virae-strategy-core/hit-price-snipe';
import * as btc15mValueSnipe from '@viraeai/virae-strategy-core/btc15m-value-snipe';
import * as memecoinMomentumGuard from '@viraeai/virae-strategy-core/memecoin-momentum-guard';
import * as memecoinLaunchScout from '@viraeai/virae-strategy-core/memecoin-launch-scout';
assert.equal(typeof root.decideCryptoTailEntry, 'function');
assert.equal(typeof subpath.buildCryptoTailEntryExecutionPlan, 'function');
assert.equal(typeof preMarket.buildPreMarketEntryPlan, 'function');
assert.equal(typeof muskTweetCount.decideMuskTweetCountEntry, 'function');
assert.equal(typeof weatherTemperature.decideWeatherTemperatureEntry, 'function');
assert.equal(typeof hitPriceSnipe.runHitPriceSnipeSystemSimulationMatrix, 'function');
assert.equal(typeof btc15mValueSnipe.runBtc15mValueSnipeSystemSimulationMatrix, 'function');
assert.equal(typeof memecoinMomentumGuard.decideMemecoinMomentumEntry, 'function');
assert.equal(typeof memecoinLaunchScout.decideMemecoinLaunchEntry, 'function');
`);
  run(process.execPath, ['consumer.mjs'], consumerRoot);

  writeFileSync(join(consumerRoot, 'skill-consumer.mjs'), `
import assert from 'node:assert/strict';
import { evaluate } from '@viraeai/virae-strategy-core/skills/virae-strategy-core/scripts/runtime.mjs';
import { DEFAULT_MUSK_TWEET_STRATEGY_CONFIG } from '@viraeai/virae-strategy-core/musk-tweet-count';
import { DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG } from '@viraeai/virae-strategy-core/weather-temperature';
const nowSec = 2000000000;
const nowIso = new Date(nowSec * 1000).toISOString();
const currentSnapshot = {
  id: 'skill-snapshot', capturedAt: nowIso,
  market: { eventSlug: 'skill-market', title: 'Skill market', startAt: nowIso, endAt: new Date((nowSec + 21600) * 1000).toISOString(), status: 'active', ranges: [{ label: '<40', minInclusive: 0, maxInclusive: 39, yesTokenId: 'skill-yes', noTokenId: 'skill-no' }] },
  counter: { count: 39, source: 'xtracker', fresh: true, updatedAt: nowIso },
  rates: { rate30m: 0, rate60m: 0, rate2h: 1, rate6h: 1, rate24h: 1, cooldownHours: 0, eventFactor: 'normal' },
  remainingHours: 6,
  orderbooks: [{ tokenId: 'skill-no', minOrderSize: 0.5, bestBid: 0.94, bestAsk: 0.95, spread: 0.01, topDepthUsd: 100, fresh: true, source: 'REST' }],
  diagnostics: [],
};
const output = evaluate('musk-tweet-count-entry', { currentSnapshot, config: DEFAULT_MUSK_TWEET_STRATEGY_CONFIG.entry, nowSec });
assert.equal(output.result.reasonCode, 'CURRENT_MARKET_INTENT');
assert.equal(output.result.selectedIntent.amount, 187.5);
const weatherOutput = evaluate('weather-temperature-entry', {
  nowSec: Date.parse('2026-08-17T23:00:00Z') / 1000,
  config: DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG,
  snapshot: {
    capturedAt: '2026-08-17T22:59:00Z', forecastRunKey: 'gfs-e2e', eventSlug: 'weather-e2e', eventTitle: 'Weather E2E',
    stationCode: 'KLGA', timezone: 'America/New_York', targetDate: '2026-08-18', metric: 'high',
    ensembleMemberCount: 31, ensembleStdDevF: 2,
    candidates: [{ marketId: 'weather-market', yesTokenId: 'weather-yes', bucket: { label: '80-81F', lowerBound: 80, upperBound: 81 }, modelProbability: 0.4,
      quote: { bestAsk: 0.2, bestBid: 0.19, spread: 0.01, minOrderSize: 5, topAskDepthUsd: 100, fresh: true, acceptingOrders: true } }],
  },
});
assert.equal(weatherOutput.result.reasonCode, 'ENTRY_INTENTS');
assert.equal(weatherOutput.result.intents.length, 1);
const hitPriceOutput = evaluate('hit-price-snipe-system-matrix', {});
assert.equal(hitPriceOutput.count, 20);
assert.equal(hitPriceOutput.results.every((row) => row.passed), true);
const valueOutput = evaluate('btc15m-value-snipe-system-matrix', {});
assert.equal(valueOutput.count, 20);
assert.equal(valueOutput.results.every((row) => row.passed), true);
const memecoinOutput = evaluate('memecoin-momentum-system-matrix', {});
assert.equal(memecoinOutput.count, 15);
assert.equal(memecoinOutput.results.every((row) => row.passed), true);
const launchScoutOutput = evaluate('memecoin-launch-scout-system-matrix', {});
assert.equal(launchScoutOutput.count, 21);
assert.equal(launchScoutOutput.results.every((row) => row.passed), true);
`);
  run(process.execPath, ['skill-consumer.mjs'], consumerRoot);

  writeFileSync(join(consumerRoot, 'consumer.ts'), `
import {
  CRYPTO_TAIL_STRATEGY_MANIFEST,
  decideCryptoTailEntry,
  type CryptoTailDecisionInput,
} from '@viraeai/virae-strategy-core/crypto-tail';
import {
  buildPreMarketEntryPlan,
  type PreMarketRoundInput,
} from '@viraeai/virae-strategy-core/pre-market';
import {
  decideMuskTweetCountEntry,
  type MuskTweetSnapshot,
} from '@viraeai/virae-strategy-core/musk-tweet-count';
import {
  runHitPriceSnipeSystemSimulationMatrix,
} from '@viraeai/virae-strategy-core/hit-price-snipe';
import {
  runBtc15mValueSnipeSystemSimulationMatrix,
} from '@viraeai/virae-strategy-core/btc15m-value-snipe';
import {
  decideMemecoinMomentumEntry,
  type MemecoinMomentumEntryInput,
} from '@viraeai/virae-strategy-core/memecoin-momentum-guard';
const input = null as unknown as CryptoTailDecisionInput;
if (input) decideCryptoTailEntry(input);
const policyVersion: number = CRYPTO_TAIL_STRATEGY_MANIFEST.executionPolicyVersion;
void policyVersion;
const round = null as unknown as PreMarketRoundInput;
if (round) buildPreMarketEntryPlan({ round });
const muskSnapshot = null as unknown as MuskTweetSnapshot;
if (muskSnapshot) decideMuskTweetCountEntry({ currentSnapshot: muskSnapshot, config: {} as never, nowSec: 0 });
runHitPriceSnipeSystemSimulationMatrix();
runBtc15mValueSnipeSystemSimulationMatrix();
const memecoinInput = null as unknown as MemecoinMomentumEntryInput;
if (memecoinInput) decideMemecoinMomentumEntry(memecoinInput);
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
    'btc15m-value-snipe',
    'catalog.d.ts',
    'catalog.d.ts.map',
    'catalog.js',
    'catalog.js.map',
    'crypto-tail',
    'hit-price-snipe',
    'index.d.ts',
    'index.d.ts.map',
    'index.js',
    'index.js.map',
    'memecoin-launch-scout',
    'memecoin-momentum-guard',
    'musk-tweet-count',
    'pre-market',
    'weather-temperature',
  ]);

  console.log(`e2e consumer verified ${installedMetadata.name}@${installedMetadata.version}`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
