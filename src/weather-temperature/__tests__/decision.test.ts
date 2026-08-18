import {
  DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG,
  decideWeatherTemperatureEntry,
  normalizeWeatherTemperatureStrategyConfig,
  type WeatherTemperatureSnapshot,
} from '..';

const snapshot: WeatherTemperatureSnapshot = {
  capturedAt: '2026-08-18T22:00:00.000Z',
  forecastRunKey: 'weather:2026-08-18T22',
  eventSlug: 'highest-temperature-in-nyc-on-august-19',
  eventTitle: 'Highest temperature in NYC on August 19?',
  stationCode: 'KLGA',
  timezone: 'America/New_York',
  targetDate: '2026-08-19',
  metric: 'high',
  ensembleMemberCount: 31,
  ensembleStdDevF: 2,
  candidates: [
    {
      marketId: 'm1',
      yesTokenId: 't1',
      bucket: { label: '84-85F', lowerBound: 84, upperBound: 85 },
      modelProbability: 0.42,
      quote: { bestAsk: 0.25, bestBid: 0.23, spread: 0.02, minOrderSize: 5, topAskDepthUsd: 50, fresh: true, acceptingOrders: true },
    },
    {
      marketId: 'm2',
      yesTokenId: 't2',
      bucket: { label: '86-87F', lowerBound: 86, upperBound: 87 },
      modelProbability: 0.3,
      quote: { bestAsk: 0.24, bestBid: 0.22, spread: 0.02, minOrderSize: 5, topAskDepthUsd: 50, fresh: true, acceptingOrders: true },
    },
  ],
};

test('produces one deterministic TOP1 intent from a fresh pre-day snapshot', () => {
  const result = decideWeatherTemperatureEntry({
    snapshot,
    config: { ...DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG, eventBudgetUsd: 20 },
    nowSec: Date.parse(snapshot.capturedAt) / 1_000,
  });
  expect(result.reasonCode).toBe('ENTRY_INTENTS');
  expect(result.intents).toHaveLength(1);
  expect(result.intents[0]).toMatchObject({ marketId: 'm1', tokenId: 't1', amount: 20, limitPrice: 0.25 });
});

test('fails closed when the CLOB quote is stale', () => {
  const result = decideWeatherTemperatureEntry({
    snapshot: {
      ...snapshot,
      candidates: [{ ...snapshot.candidates[0], quote: { ...snapshot.candidates[0].quote, fresh: false } }],
    },
    config: DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG,
    nowSec: Date.parse(snapshot.capturedAt) / 1_000,
  });
  expect(result.intents).toHaveLength(0);
  expect(result.evaluations[0].reasonCode).toBe('ORDERBOOK_STALE');
});

test('fails closed when the ensemble has fewer than ten members', () => {
  const result = decideWeatherTemperatureEntry({
    snapshot: { ...snapshot, ensembleMemberCount: 9 },
    config: DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG,
    nowSec: Date.parse(snapshot.capturedAt) / 1_000,
  });
  expect(result).toMatchObject({ reasonCode: 'INVALID_INPUT', diagnostics: ['FORECAST_MEMBER_COUNT_TOO_LOW'] });
});

test('fails closed when the ensemble member count is non-finite', () => {
  const result = decideWeatherTemperatureEntry({
    snapshot: { ...snapshot, ensembleMemberCount: Number.NaN },
    config: DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG,
    nowSec: Date.parse(snapshot.capturedAt) / 1_000,
  });
  expect(result).toMatchObject({ reasonCode: 'INVALID_INPUT', diagnostics: ['FORECAST_MEMBER_COUNT_INVALID'] });
});

test('rejects a crossed order book', () => {
  const result = decideWeatherTemperatureEntry({
    snapshot: {
      ...snapshot,
      candidates: [{
        ...snapshot.candidates[0],
        quote: { ...snapshot.candidates[0].quote, bestBid: 0.3, bestAsk: 0.25 },
      }],
    },
    config: DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG,
    nowSec: Date.parse(snapshot.capturedAt) / 1_000,
  });
  expect(result.intents).toHaveLength(0);
  expect(result.evaluations[0].reasonCode).toBe('CROSSED_ORDERBOOK');
});

test('fails closed when the snapshot station is outside the configured station set', () => {
  const result = decideWeatherTemperatureEntry({
    snapshot,
    config: { ...DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG, stationCodes: ['KORD'] },
    nowSec: Date.parse(snapshot.capturedAt) / 1_000,
  });
  expect(result).toMatchObject({ reasonCode: 'INVALID_INPUT', diagnostics: ['STATION_NOT_CONFIGURED'] });
});

test.each([
  [{ timezone: 'Not/A_Timezone' }, 'TIMEZONE_INVALID'],
  [{ targetDate: '2026-02-30' }, 'TARGET_DATE_INVALID'],
] as const)('returns INVALID_INPUT instead of throwing for malformed calendar data', (patch, diagnostic) => {
  expect(() => decideWeatherTemperatureEntry({
    snapshot: { ...snapshot, ...patch },
    config: DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG,
    nowSec: Date.parse(snapshot.capturedAt) / 1_000,
  })).not.toThrow();
  expect(decideWeatherTemperatureEntry({
    snapshot: { ...snapshot, ...patch },
    config: DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG,
    nowSec: Date.parse(snapshot.capturedAt) / 1_000,
  })).toMatchObject({ reasonCode: 'INVALID_INPUT', diagnostics: [diagnostic] });
});

test('rejects non-finite market data instead of letting NaN pass comparison gates', () => {
  const result = decideWeatherTemperatureEntry({
    snapshot: {
      ...snapshot,
      candidates: [{ ...snapshot.candidates[0], modelProbability: Number.NaN }],
    },
    config: DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG,
    nowSec: Date.parse(snapshot.capturedAt) / 1_000,
  });
  expect(result.intents).toHaveLength(0);
  expect(result.evaluations[0].reasonCode).toBe('MODEL_PROBABILITY_INVALID');
});

test('rejects an intent whose event allocation cannot satisfy the venue minimum size', () => {
  const result = decideWeatherTemperatureEntry({
    snapshot: {
      ...snapshot,
      candidates: [{
        ...snapshot.candidates[0],
        quote: { ...snapshot.candidates[0].quote, minOrderSize: 100 },
      }],
    },
    config: DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG,
    nowSec: Date.parse(snapshot.capturedAt) / 1_000,
  });
  expect(result).toMatchObject({ reasonCode: 'NO_ELIGIBLE_BUCKET', diagnostics: ['ORDER_SIZE_BELOW_MARKET_MINIMUM'] });
  expect(result.evaluations[0].reasonCode).toBe('ORDER_SIZE_BELOW_MARKET_MINIMUM');
});

test('keeps adjacent TOP2 cent allocations equal to the configured event budget', () => {
  const result = decideWeatherTemperatureEntry({
    snapshot,
    config: {
      ...DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG,
      selectionPolicy: 'ADJACENT_TOP2',
      maxBucketsPerEvent: 2,
      eventBudgetUsd: 20.01,
      minEdge: 0.05,
    },
    nowSec: Date.parse(snapshot.capturedAt) / 1_000,
  });
  expect(result.intents).toHaveLength(2);
  expect(result.intents.reduce((sum, intent) => sum + Math.round(intent.amount * 100), 0)).toBe(2001);
});

test('normalization restores a non-empty station list and a valid entry price range', () => {
  const config = normalizeWeatherTemperatureStrategyConfig({
    entryConfig: { stationCodes: [], minEntryAsk: 0.9, maxEntryAsk: 0.1 },
  });
  expect(config.entry.stationCodes).toEqual(['KLGA']);
  expect(config.entry.minEntryAsk).toBeLessThanOrEqual(config.entry.maxEntryAsk);
  expect(normalizeWeatherTemperatureStrategyConfig({
    entryConfig: { stationCodes: [' klga ', 'KJFK', 'KLGA'] },
  }).entry.stationCodes).toEqual(['KLGA', 'KJFK']);
});

test('rejects duplicate candidate identity before generating intents', () => {
  const duplicatedSnapshot = { ...snapshot, candidates: [...snapshot.candidates, { ...snapshot.candidates[0] }] };
  expect(decideWeatherTemperatureEntry({
    snapshot: duplicatedSnapshot,
    config: DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG,
    nowSec: Date.parse(snapshot.capturedAt) / 1_000,
  })).toMatchObject({
    reasonCode: 'INVALID_INPUT',
    diagnostics: ['CANDIDATE_IDENTITY_DUPLICATED'],
    intents: [],
  });
});

test('rejects malformed direct configuration even when normalization is bypassed', () => {
  expect(decideWeatherTemperatureEntry({
    snapshot,
    config: { ...DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG, orderTtlSeconds: 0 },
    nowSec: Date.parse(snapshot.capturedAt) / 1_000,
  })).toMatchObject({ reasonCode: 'INVALID_INPUT', diagnostics: ['CONFIG_INVALID'], intents: [] });
});
