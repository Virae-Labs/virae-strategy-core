import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const packageRoot = fileURLToPath(new URL('../../../', import.meta.url));

export function loadCore() {
  const entrypoint = resolve(packageRoot, 'dist/index.js');
  if (!existsSync(entrypoint)) {
    throw new Error(`Missing ${entrypoint}. Run npm run build from ${packageRoot}.`);
  }
  return require(entrypoint);
}

export function packageMetadata() {
  return JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
}

export function parseCliArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value == null) {
      throw new Error('Arguments must use --name value pairs.');
    }
    args[flag.slice(2)] = value;
  }
  return args;
}

export function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

export function evaluate(operation, input) {
  const core = loadCore();
  if (operation === 'crypto-tail-entry') {
    const decision = core.decideCryptoTailEntry(input);
    const executionPlan = decision.decision === 'ELIGIBLE'
      ? core.buildCryptoTailEntryExecutionPlan({ decision, config: input.config })
      : { ok: false, reasonCode: 'DECISION_NOT_ELIGIBLE' };
    return { operation, manifest: core.CRYPTO_TAIL_STRATEGY_MANIFEST, decision, executionPlan };
  }
  if (operation === 'pre-market-entry') {
    return {
      operation,
      manifest: core.PRE_MARKET_STRATEGY_MANIFEST,
      result: core.buildPreMarketEntryPlan(input),
    };
  }
  if (operation === 'pre-market-take-profit') {
    return {
      operation,
      manifest: core.PRE_MARKET_STRATEGY_MANIFEST,
      intents: core.buildPreMarketTakeProfitIntents(input),
    };
  }
  if (operation === 'musk-tweet-count-entry') {
    return {
      operation,
      manifest: core.MUSK_TWEET_COUNT_STRATEGY_MANIFEST,
      result: core.decideMuskTweetCountEntry(input),
    };
  }
  if (operation === 'weather-temperature-entry') {
    return {
      operation,
      manifest: core.WEATHER_TEMPERATURE_STRATEGY_MANIFEST,
      result: core.decideWeatherTemperatureEntry(input),
    };
  }
  if (operation === 'hit-price-snipe-entry') {
    return {
      operation,
      manifest: core.HIT_PRICE_SNIPE_STRATEGY_MANIFEST,
      result: core.decideHitPriceSnipeEntry(input),
    };
  }
  if (operation === 'hit-price-snipe-system-matrix') {
    const matrix = Array.isArray(input?.matrix) ? input.matrix : core.buildHitPriceSnipeSystemSimulationMatrix();
    return {
      operation,
      manifest: core.HIT_PRICE_SNIPE_STRATEGY_MANIFEST,
      count: matrix.length,
      results: core.runHitPriceSnipeSystemSimulationMatrix(matrix),
    };
  }
  if (operation === 'btc15m-value-snipe-entry') {
    return {
      operation,
      manifest: core.BTC15M_VALUE_SNIPE_STRATEGY_MANIFEST,
      result: core.decideBtc15mValueSnipeEntry(input),
    };
  }
  if (operation === 'btc15m-value-snipe-system-matrix') {
    const matrix = Array.isArray(input?.matrix)
      ? input.matrix
      : input?.venue
        ? core.buildBtc15mValueSnipeSystemSimulationMatrix(input.venue)
        : undefined;
    const results = core.runBtc15mValueSnipeSystemSimulationMatrix(matrix);
    return {
      operation,
      manifest: core.BTC15M_VALUE_SNIPE_STRATEGY_MANIFEST,
      count: results.length,
      results,
    };
  }
  throw new Error(`Unsupported operation: ${operation ?? '(missing)'}`);
}
