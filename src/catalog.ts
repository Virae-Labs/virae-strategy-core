import { CRYPTO_TAIL_PROFILE_KEYS, CRYPTO_TAIL_STRATEGY_MANIFEST } from './crypto-tail';
import { PRE_MARKET_STRATEGY_MANIFEST } from './pre-market';
import { MUSK_TWEET_COUNT_STRATEGY_MANIFEST } from './musk-tweet-count';
import { WEATHER_TEMPERATURE_STRATEGY_MANIFEST } from './weather-temperature';
import { HIT_PRICE_SNIPE_STRATEGY_MANIFEST } from './hit-price-snipe';
import { BTC15M_VALUE_SNIPE_STRATEGY_MANIFEST } from './btc15m-value-snipe';
import { MEMECOIN_MOMENTUM_GUARD_STRATEGY_MANIFEST } from './memecoin-momentum-guard';
import { MEMECOIN_LAUNCH_SCOUT_STRATEGY_MANIFEST } from './memecoin-launch-scout';

export type ViraeStrategyCoreKey =
  | 'crypto-tail'
  | 'pre-market'
  | 'musk-tweet-count'
  | 'weather-temperature'
  | 'hit-price-snipe'
  | 'btc15m-value-snipe'
  | 'memecoin-momentum-guard'
  | 'memecoin-launch-scout';

export type ViraeStrategyCoreCatalogEntry = {
  key: ViraeStrategyCoreKey;
  packageName: '@viraeai/virae-strategy-core';
  module: ViraeStrategyCoreKey;
  autoTradeStrategyKeys: readonly string[];
  capabilities: {
    decision: boolean;
    orderIntents: boolean;
    replay: boolean;
    networkAccess: false;
    orderSubmission: false;
  };
  manifest:
    | typeof CRYPTO_TAIL_STRATEGY_MANIFEST
    | typeof PRE_MARKET_STRATEGY_MANIFEST
    | typeof MUSK_TWEET_COUNT_STRATEGY_MANIFEST
    | typeof WEATHER_TEMPERATURE_STRATEGY_MANIFEST
    | typeof HIT_PRICE_SNIPE_STRATEGY_MANIFEST
    | typeof BTC15M_VALUE_SNIPE_STRATEGY_MANIFEST
    | typeof MEMECOIN_MOMENTUM_GUARD_STRATEGY_MANIFEST
    | typeof MEMECOIN_LAUNCH_SCOUT_STRATEGY_MANIFEST;
};

/**
 * Machine-readable strategy discovery for local tools, AI skills, and hosts.
 * The installed package version is intentionally read from package.json by the
 * host so this catalog cannot drift from the artifact that contains it.
 */
export const VIRAE_STRATEGY_CORE_CATALOG = [
  {
    key: 'crypto-tail',
    packageName: '@viraeai/virae-strategy-core',
    module: 'crypto-tail',
    autoTradeStrategyKeys: CRYPTO_TAIL_PROFILE_KEYS,
    capabilities: {
      decision: true,
      orderIntents: true,
      replay: true,
      networkAccess: false,
      orderSubmission: false,
    },
    manifest: CRYPTO_TAIL_STRATEGY_MANIFEST,
  },
  {
    key: 'pre-market',
    packageName: '@viraeai/virae-strategy-core',
    module: 'pre-market',
    autoTradeStrategyKeys: ['btc-15m-premarket'],
    capabilities: {
      decision: true,
      orderIntents: true,
      replay: true,
      networkAccess: false,
      orderSubmission: false,
    },
    manifest: PRE_MARKET_STRATEGY_MANIFEST,
  },
  {
    key: 'musk-tweet-count',
    packageName: '@viraeai/virae-strategy-core',
    module: 'musk-tweet-count',
    autoTradeStrategyKeys: ['musk-tweet-count'],
    capabilities: {
      decision: true,
      orderIntents: true,
      replay: true,
      networkAccess: false,
      orderSubmission: false,
    },
    manifest: MUSK_TWEET_COUNT_STRATEGY_MANIFEST,
  },
  {
    key: 'weather-temperature',
    packageName: '@viraeai/virae-strategy-core',
    module: 'weather-temperature',
    autoTradeStrategyKeys: ['weather-temperature'],
    capabilities: {
      decision: true,
      orderIntents: true,
      replay: true,
      networkAccess: false,
      orderSubmission: false,
    },
    manifest: WEATHER_TEMPERATURE_STRATEGY_MANIFEST,
  },
  {
    key: 'hit-price-snipe',
    packageName: '@viraeai/virae-strategy-core',
    module: 'hit-price-snipe',
    autoTradeStrategyKeys: ['hit-price-snipe'],
    capabilities: {
      decision: true,
      orderIntents: true,
      replay: true,
      networkAccess: false,
      orderSubmission: false,
    },
    manifest: HIT_PRICE_SNIPE_STRATEGY_MANIFEST,
  },
  {
    key: 'btc15m-value-snipe',
    packageName: '@viraeai/virae-strategy-core',
    module: 'btc15m-value-snipe',
    autoTradeStrategyKeys: ['btc15m-value-snipe'],
    capabilities: {
      decision: true,
      orderIntents: false,
      replay: true,
      networkAccess: false,
      orderSubmission: false,
    },
    manifest: BTC15M_VALUE_SNIPE_STRATEGY_MANIFEST,
  },
  {
    key: 'memecoin-momentum-guard',
    packageName: '@viraeai/virae-strategy-core',
    module: 'memecoin-momentum-guard',
    autoTradeStrategyKeys: ['memecoin-momentum-guard'],
    capabilities: {
      decision: true,
      orderIntents: false,
      replay: true,
      networkAccess: false,
      orderSubmission: false,
    },
    manifest: MEMECOIN_MOMENTUM_GUARD_STRATEGY_MANIFEST,
  },
  {
    key: 'memecoin-launch-scout',
    packageName: '@viraeai/virae-strategy-core',
    module: 'memecoin-launch-scout',
    autoTradeStrategyKeys: ['memecoin-launch-scout'],
    capabilities: { decision: true, orderIntents: false, replay: true, networkAccess: false, orderSubmission: false },
    manifest: MEMECOIN_LAUNCH_SCOUT_STRATEGY_MANIFEST,
  },
] as const satisfies readonly ViraeStrategyCoreCatalogEntry[];
