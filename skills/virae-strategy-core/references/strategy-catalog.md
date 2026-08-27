# Strategy catalog

Treat `VIRAE_STRATEGY_CORE_CATALOG` as the machine-readable source of truth. Run `scripts/list-strategies.mjs` instead of copying versions into prompts.

| Core key | Package module | Virae Auto Trade keys | Local operations |
| --- | --- | --- | --- |
| `crypto-tail` | `@viraeai/virae-strategy-core/crypto-tail` | BTC, ETH, SOL, DOGE, XRP, and BNB at `15m` and `1h` | Decision, entry intent, replay |
| `pre-market` | `@viraeai/virae-strategy-core/pre-market` | `btc-15m-premarket` | Entry ladder intents, take-profit intents, replay |
| `musk-tweet-count` | `@viraeai/virae-strategy-core/musk-tweet-count` | `musk-tweet-count` | Current/next decision, selected intent, risk-stop policy, replay |
| `weather-temperature` | `@viraeai/virae-strategy-core/weather-temperature` | `weather-temperature` | Per-bucket evaluation, TOP1/adjacent TOP2 intents, replay |
| `hit-price-snipe` | `@viraeai/virae-strategy-core/hit-price-snipe` | `hit-price-snipe` | Confirm-hit/Pre-hit decision, FAK fill/PnL simulation, system matrix replay |
| `btc15m-value-snipe` | `@viraeai/virae-strategy-core/btc15m-value-snipe` | `btc15m-value-snipe` | Venue-aware recurring BTC 15m decision and Polymarket/Predict.fun matrix replay |
| `memecoin-momentum-guard` | `@viraeai/virae-strategy-core/memecoin-momentum-guard` | `memecoin-momentum-guard` | Solana momentum entry, executable-proceeds exit, and system matrix replay |

The catalog intentionally omits its own package version. Read `package.json` from the installed artifact so the reported package version cannot drift from the code being executed. Strategy manifests carry model, input-schema, and execution-policy versions.

Not every Virae Auto Trade strategy is necessarily open-source or locally executable. For the current hosted list and Paper/Live support, query Virae's strategy discovery API through `virae-ai-skill`.
