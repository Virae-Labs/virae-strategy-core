# Virae Strategy Core

Deterministic strategy decisions and execution policies used by Virae auto-trading.

This repository deliberately contains no wallet credentials, signing code, database access, live market-data clients, or exchange side effects. A caller supplies normalized snapshots and executes the returned order commands through its own adapter.

## What is public

The Crypto Tail module answers four questions:

1. Should the strategy enter this round?
2. Which outcome, price, and size should it use?
3. When should an unfilled entry be cancelled or chased?
4. How should fills, exits, risk stops, and settlement advance the lifecycle?

```ts
import {
  buildCryptoTailEntryExecutionPlan,
  decideCryptoTailEntry,
  REFERENCE_CRYPTO_TAIL_CONFIG_V1,
} from '@viraeai/virae-strategy-core/crypto-tail';

const decision = decideCryptoTailEntry({
  nowSec,
  round,
  chainlink: oracle,
  orderbook,
  risk,
  global,
  config: REFERENCE_CRYPTO_TAIL_CONFIG_V1,
});

const execution = buildCryptoTailEntryExecutionPlan({
  decision,
  config: REFERENCE_CRYPTO_TAIL_CONFIG_V1,
});
```

`execution.plan.order` is an intent, not an exchange call. The host remains responsible for authentication, balance checks, venue restrictions, duplicate suppression, submission, reconciliation, persistence, and monitoring.

## Reference configuration

`REFERENCE_CRYPTO_TAIL_CONFIG_V1` makes examples and paper replay runnable. It is not a statement of Virae's current production calibration, financial advice, or a promise of profitable results.

## Development

```bash
npm install
npm test
npm run build
```

## Safety

The package is deterministic and side-effect free. Do not connect its output to real funds without independent validation, venue-specific safety checks, idempotency, and reconciliation.
