# Strategy catalog

Treat `VIRAE_STRATEGY_CORE_CATALOG` as the machine-readable source of truth. Run `scripts/list-strategies.mjs` instead of copying versions into prompts.

| Core key | Package module | Virae Auto Trade keys | Local operations |
| --- | --- | --- | --- |
| `crypto-tail` | `@viraeai/virae-strategy-core/crypto-tail` | `btc-15m-tail`, `eth-15m-tail`, `btc-1h-tail`, `eth-1h-tail` | Decision, entry intent, replay |
| `pre-market` | `@viraeai/virae-strategy-core/pre-market` | `btc-15m-premarket` | Entry ladder intents, take-profit intents, replay |
| `musk-tweet-count` | `@viraeai/virae-strategy-core/musk-tweet-count` | `musk-tweet-count` | Current/next decision, selected intent, risk-stop policy, replay |

The catalog intentionally omits its own package version. Read `package.json` from the installed artifact so the reported package version cannot drift from the code being executed. Strategy manifests carry model, input-schema, and execution-policy versions.

Not every Virae Auto Trade strategy is necessarily open-source or locally executable. For the current hosted list and Paper/Live support, query Virae's strategy discovery API through `virae-ai-skill`.
