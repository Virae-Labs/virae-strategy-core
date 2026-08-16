import { loadCore, packageMetadata } from './runtime.mjs';

const core = loadCore();
const metadata = packageMetadata();

process.stdout.write(`${JSON.stringify({
  package: { name: metadata.name, version: metadata.version },
  strategies: core.VIRAE_STRATEGY_CORE_CATALOG,
}, null, 2)}\n`);
