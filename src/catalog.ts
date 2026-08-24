import { CRYPTO_TAIL_PROFILE_KEYS, CRYPTO_TAIL_STRATEGY_MANIFEST } from './crypto-tail';
import { PRE_MARKET_STRATEGY_MANIFEST } from './pre-market';
import { MUSK_TWEET_COUNT_STRATEGY_MANIFEST } from './musk-tweet-count';
import { WEATHER_TEMPERATURE_STRATEGY_MANIFEST } from './weather-temperature';
import { EV_SNIPE_STRATEGY_MANIFEST } from './ev-snipe';

export type ViraeStrategyCoreCatalogEntry = {
  key: 'crypto-tail' | 'pre-market' | 'musk-tweet-count' | 'weather-temperature' | 'ev-snipe';
  packageName: '@viraeai/virae-strategy-core';
  module: 'crypto-tail' | 'pre-market' | 'musk-tweet-count' | 'weather-temperature' | 'ev-snipe';
  autoTradeStrategyKeys: readonly string[];
  capabilities: {
    decision: boolean;
    orderIntents: boolean;
    replay: boolean;
    networkAccess: false;
    orderSubmission: false;
  };
  manifest: typeof CRYPTO_TAIL_STRATEGY_MANIFEST | typeof PRE_MARKET_STRATEGY_MANIFEST | typeof MUSK_TWEET_COUNT_STRATEGY_MANIFEST | typeof WEATHER_TEMPERATURE_STRATEGY_MANIFEST | typeof EV_SNIPE_STRATEGY_MANIFEST;
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
    key: 'ev-snipe',
    packageName: '@viraeai/virae-strategy-core',
    module: 'ev-snipe',
    autoTradeStrategyKeys: [],
    capabilities: {
      decision: true,
      orderIntents: true,
      replay: true,
      networkAccess: false,
      orderSubmission: false,
    },
    manifest: EV_SNIPE_STRATEGY_MANIFEST,
  },
] as const satisfies readonly ViraeStrategyCoreCatalogEntry[];
