import { CRYPTO_TAIL_STRATEGY_MANIFEST } from './crypto-tail';
import { PRE_MARKET_STRATEGY_MANIFEST } from './pre-market';

export type ViraeStrategyCoreCatalogEntry = {
  key: 'crypto-tail' | 'pre-market';
  packageName: '@viraeai/virae-strategy-core';
  module: 'crypto-tail' | 'pre-market';
  autoTradeStrategyKeys: readonly string[];
  capabilities: {
    decision: boolean;
    orderIntents: boolean;
    replay: boolean;
    networkAccess: false;
    orderSubmission: false;
  };
  manifest: typeof CRYPTO_TAIL_STRATEGY_MANIFEST | typeof PRE_MARKET_STRATEGY_MANIFEST;
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
    autoTradeStrategyKeys: [
      'btc-15m-tail',
      'eth-15m-tail',
      'btc-1h-tail',
      'eth-1h-tail',
    ],
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
] as const satisfies readonly ViraeStrategyCoreCatalogEntry[];
