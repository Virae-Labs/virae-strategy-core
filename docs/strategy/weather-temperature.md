# Weather Temperature strategy design

## Status and scope

- Strategy ID: `polymarket-weather-temperature-gfs`
- Model/config version: `weather-gfs-v3`
- Input schema version: `1`
- Execution policy version: `1`
- Supported metric contract: daily station high or low temperature buckets

`WEATHER_TEMPERATURE_STRATEGY_MANIFEST` is the durable strategy identity. Persist it, the installed package version, effective configuration, forecast run key, and snapshot with every decision and order.

The module converts host-provided ensemble probabilities and fresh CLOB quotes into deterministic YES limit-order intents. It performs no event discovery, weather download, probability modeling, network request, persistence, signing, or order submission.

## What the host must provide

`WeatherTemperatureSnapshot` represents one coherent event and forecast run:

| Input | Meaning and requirement |
| --- | --- |
| `capturedAt` | Parseable snapshot timestamp used for audit; freshness is asserted by the host |
| `forecastRunKey` | Stable identity of the forecast/model run; included in every intent key |
| `eventSlug`, `eventTitle` | Venue event identity and descriptive title |
| `stationCode` | Settlement station, for example `KLGA`; must be allowed by configuration |
| `timezone` | Valid IANA timezone for the settlement station |
| `targetDate` | Strict `YYYY-MM-DD` station-local settlement date |
| `metric` | `high` or `low` |
| `ensembleMemberCount` | Number of forecast members; fewer than 10 fails closed |
| `ensembleStdDevF` | Finite non-negative forecast dispersion in degrees Fahrenheit |
| `candidates` | Every temperature bucket with identity, bounds, model probability, and quote |

Each candidate requires a unique `marketId` and `yesTokenId`, a non-empty bucket label, finite ordered bounds, a model probability in `[0, 1]`, and quote metadata:

- `bestAsk`, optional `bestBid`, and `spread` as probability prices;
- `topAskDepthUsd` and venue `minOrderSize`;
- `fresh` and `acceptingOrders`, asserted by the host after checking live data.

The core consumes `modelProbability`; it does **not** derive it from raw GFS members. The host owns unit conversion, station mapping, bucket inclusivity, forecast bias correction, probability calibration, and confirmation that the forecast variable matches the market's resolution source and daily high/low definition.

## Minimal usage

```ts
import {
  DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG,
  WEATHER_TEMPERATURE_STRATEGY_MANIFEST,
  decideWeatherTemperatureEntry,
} from '@viraeai/virae-strategy-core/weather-temperature';

const decision = decideWeatherTemperatureEntry({
  nowSec: Date.parse('2026-08-17T23:00:00Z') / 1_000,
  config: DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG,
  snapshot: {
    capturedAt: '2026-08-17T22:59:45Z',
    forecastRunKey: 'gfs:2026-08-17T18Z:KLGA:2026-08-18:high',
    eventSlug: 'highest-temperature-in-nyc-on-august-18',
    eventTitle: 'Highest temperature in NYC on August 18?',
    stationCode: 'KLGA',
    timezone: 'America/New_York',
    targetDate: '2026-08-18',
    metric: 'high',
    ensembleMemberCount: 31,
    ensembleStdDevF: 2.1,
    candidates: [{
      marketId: 'market-80-81',
      yesTokenId: 'yes-80-81',
      bucket: { label: '80–81°F', lowerBound: 80, upperBound: 81 },
      modelProbability: 0.36,
      quote: {
        bestAsk: 0.22,
        bestBid: 0.20,
        spread: 0.02,
        minOrderSize: 5,
        topAskDepthUsd: 80,
        fresh: true,
        acceptingOrders: true,
      },
    }],
  },
});

await audit.persist({ manifest: WEATHER_TEMPERATURE_STRATEGY_MANIFEST, decision });
// decision.intents are candidates for a separate validated execution host.
```

The `audit` object is caller-defined. Calling the decision function does not submit an order.

## Timing policies

Timing always uses the supplied IANA timezone and target date.

| Policy | Eligibility |
| --- | --- |
| `PRE_DAY` | On the station-local calendar day before `targetDate`, at or after `preDayStartLocalHour` |
| `EARLY_DAY` + `high` | On `targetDate`, at or before `highCutoffLocalHour` |
| `EARLY_DAY` + `low` | On `targetDate`, at or before `lowCutoffLocalHour` |

The defaults are pre-day entry from 18:00 local, high-temperature cutoff at 09:00 local, and low-temperature cutoff at 03:00 local. Invalid dates and timezones return `INVALID_INPUT`; the main decision API does not throw for them. The exported low-level clock/timing helpers expect already validated inputs.

## Signal profiles

Profiles initialize signal thresholds. Explicit overrides are normalized within documented bounds.

| Profile | Min probability | Min edge | Ask range | Max spread | Max ensemble σ |
| --- | ---: | ---: | ---: | ---: | ---: |
| `STRICT` | 0.35 | 0.15 | 0.05–0.50 | 0.03 | 2°F |
| `CORE` | 0.25 | 0.10 | 0.03–0.65 | 0.05 | 3°F |
| `WIDE` | 0.15 | 0.07 | 0.02–0.75 | 0.08 | 4°F |

Edge is calculated per bucket:

```text
edge = modelProbability - bestAsk
```

These thresholds are policy parameters, not evidence that forecast probabilities are calibrated or profitable.

## Gate order

The decision first validates the snapshot and direct configuration, including station allowlist, metric, date/timezone, forecast health, unique candidate identity, bucket bounds, budget, hours, TTL, and numeric ranges. It then evaluates each candidate in stable order:

1. station-local timing matches the selected entry policy;
2. ensemble dispersion does not exceed the profile threshold;
3. market accepts orders and the order book is fresh;
4. probability and quote values are finite and in range;
5. ask is inside the configured entry range;
6. spread and top-ask depth are valid and within limits;
7. venue minimum order size is present and valid;
8. model probability and edge meet their thresholds.

Every candidate receives `ENTER` or `WAIT` with a typed `reasonCode`. Missing values and `NaN` fail closed; they are never allowed to pass a comparison accidentally.

## Selection and sizing

`TOP1` selects the eligible bucket with the highest edge. `ADJACENT_TOP2` starts with that anchor and adds the best eligible immediate neighbor according to ordered bucket lower bounds. It does not jump across a non-adjacent bucket.

For two selected buckets, event budget is weighted by model probability:

```text
bucketNotional = eventBudgetUsd * bucketProbability / selectedProbabilityTotal
```

Allocations are calculated in integer cents; the final leg receives the remaining cents so the selected intents equal the configured event budget exactly. An intent uses BUY, LIMIT, YES token, notional amount, current best ask, and the configured TTL.

The venue minimum is expressed in shares, so each selected leg must satisfy:

```text
notionalUsd / limitPrice >= minOrderSize
```

If either leg of a selected set is below the venue minimum, the core returns no intents. This avoids silently changing a TOP2 portfolio into a different one-legged trade. Multi-leg execution is not atomic: a live host must claim the group durably, submit idempotently, reconcile each leg, and define partial-group recovery.

## Defaults and normalization

| Field | Default | Normalized range/behavior |
| --- | ---: | --- |
| `stationCodes` | `['KLGA']` | Uppercase, unique, maximum 10; empty falls back to `KLGA` |
| `profile` | `CORE` | `STRICT`, `CORE`, or `WIDE` |
| `entryTiming` | `PRE_DAY` | `PRE_DAY` or `EARLY_DAY` |
| `selectionPolicy` | `TOP1` | `TOP1` or `ADJACENT_TOP2` |
| `eventBudgetUsd` | 20 | 1–200 USD |
| `minTopAskDepthUsd` | 20 | 0–100,000 USD |
| `maxBucketsPerEvent` | 1 | Derived as 1 for TOP1 and 2 for adjacent TOP2 |
| `preDayStartLocalHour` | 18 | Whole local hour, 0–23 |
| `highCutoffLocalHour` | 9 | Whole local hour, 0–23 |
| `lowCutoffLocalHour` | 3 | Whole local hour, 0–23 |
| `orderTtlSeconds` | 120 | 30–900 seconds |

`normalizeWeatherTemperatureStrategyConfig` also returns risk defaults: 100 USD maximum open exposure, three events per day, 100 USD maximum task net loss, and no task profit stop. These values are a shared configuration contract only; the pure entry decision does not have durable portfolio state and therefore cannot enforce them. The host must apply them transactionally before submission.

`WEATHER_TEMPERATURE_SIMULATION_MATRIX` provides all Strict/Core/Wide × Pre-day/Early-day × TOP1/Adjacent-TOP2 combinations with a common simulation budget. It is for replay and comparison, not automatic live calibration.

## Result and reason codes

`WeatherTemperatureDecision` contains:

- `reasonCode`: `ENTRY_INTENTS`, `NO_ELIGIBLE_BUCKET`, or `INVALID_INPUT`;
- `intents`: zero, one, or two deterministic order intents;
- `evaluations`: a per-bucket decision, reason code, and computed edge;
- `diagnostics`: typed snapshot-, configuration-, timing-, or size-level diagnostics.

Important candidate reasons include `ORDERBOOK_STALE`, `MODEL_PROBABILITY_INVALID`, `PRICE_OUT_OF_RANGE`, `CROSSED_ORDERBOOK`, `SPREAD_TOO_WIDE`, `TOP_ASK_DEPTH_TOO_LOW`, `MIN_ORDER_SIZE_UNAVAILABLE`, `MODEL_PROBABILITY_BELOW_THRESHOLD`, `EDGE_BELOW_THRESHOLD`, and `ORDER_SIZE_BELOW_MARKET_MINIMUM`.

Intent keys are stable within the event and forecast run:

```text
<eventSlug>:<forecastRunKey>:<marketId>:<yesTokenId>
```

If uniqueness spans accounts or tasks, namespace this key with durable account/task identity. A changed forecast run intentionally creates a different core key; the host must still enforce its one-event policy and prevent multiple runs from exceeding event exposure.

## Production host responsibilities

Before submitting an intent, the host must:

1. verify station, unit, timezone, target-date, bucket inclusivity, and official resolution-source equivalence;
2. compare forecast and CLOB timestamps against documented freshness limits;
3. persist the snapshot, model run, manifest, effective configuration, decision, and durable execution claim;
4. enforce event/day/task/account exposure and concurrency-safe duplicate prevention;
5. refresh market state, ask, spread, depth, tick, minimum size, balance, and global live gate;
6. submit with a durable idempotency key and reconcile unknown outcomes before retry;
7. track partial fills, cancellation, resolution, settlement, PnL, and model calibration separately.

## Known limitations

- GFS collection and probability construction are outside this package; replay quality depends on the host snapshot.
- No spatial interpolation, station bias correction, ensemble calibration, or cross-model blending is performed here.
- Bucket adjacency relies on host-supplied bounds and does not prove venue bucket coverage is exhaustive or non-overlapping.
- The decision does not model queue position, fill probability, slippage beyond top-depth gating, fees, correlated event exposure, or forecast revisions after entry.
- TOP2 intent generation is deterministic but venue execution is not atomic.
- Deterministic replay demonstrates reproducibility, not forecast validity or profitability.

Changes to timing, profile thresholds, validation, selection, cent allocation, reason-code meaning, or intent identity are behavior changes and require tests, changelog notes, and an appropriate version increment.
