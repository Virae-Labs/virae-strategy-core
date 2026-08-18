import type {
  WeatherTemperatureEntryConfig,
  WeatherTemperatureRiskConfig,
  WeatherTemperatureSignalProfile,
  WeatherTemperatureStrategyConfig,
} from './types';

export const WEATHER_TEMPERATURE_CONFIG_VERSION = 'weather-gfs-v3';

export const WEATHER_TEMPERATURE_SIGNAL_PROFILES: ReadonlyArray<Pick<WeatherTemperatureEntryConfig,
  | 'profile'
  | 'minModelProbability'
  | 'minEdge'
  | 'minEntryAsk'
  | 'maxEntryAsk'
  | 'maxSpread'
  | 'maxEnsembleStdDevF'
>> = [
  { profile: 'STRICT', minModelProbability: 0.35, minEdge: 0.15, minEntryAsk: 0.05, maxEntryAsk: 0.5, maxSpread: 0.03, maxEnsembleStdDevF: 2 },
  { profile: 'CORE', minModelProbability: 0.25, minEdge: 0.1, minEntryAsk: 0.03, maxEntryAsk: 0.65, maxSpread: 0.05, maxEnsembleStdDevF: 3 },
  { profile: 'WIDE', minModelProbability: 0.15, minEdge: 0.07, minEntryAsk: 0.02, maxEntryAsk: 0.75, maxSpread: 0.08, maxEnsembleStdDevF: 4 },
];

const defaultsForProfile = (profile: WeatherTemperatureSignalProfile) =>
  WEATHER_TEMPERATURE_SIGNAL_PROFILES.find((candidate) => candidate.profile === profile) ?? WEATHER_TEMPERATURE_SIGNAL_PROFILES[1];

function finite(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function nullablePositive(value: unknown, fallback: number | null): number | null {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG: WeatherTemperatureEntryConfig = {
  stationCodes: ['KLGA'],
  ...defaultsForProfile('CORE'),
  profile: 'CORE',
  entryTiming: 'PRE_DAY',
  selectionPolicy: 'TOP1',
  eventBudgetUsd: 20,
  minTopAskDepthUsd: 20,
  maxBucketsPerEvent: 1,
  preDayStartLocalHour: 18,
  highCutoffLocalHour: 9,
  lowCutoffLocalHour: 3,
  orderTtlSeconds: 120,
};

export const DEFAULT_WEATHER_TEMPERATURE_RISK_CONFIG: WeatherTemperatureRiskConfig = {
  maxOpenExposureUsd: 100,
  maxEventsPerDay: 3,
  maxTaskNetLossUsd: 100,
  maxTaskNetProfitUsd: null,
};

export function normalizeWeatherTemperatureStrategyConfig(input: {
  entryConfig?: Partial<WeatherTemperatureEntryConfig> | null;
  riskConfig?: Partial<WeatherTemperatureRiskConfig> | null;
} = {}): WeatherTemperatureStrategyConfig {
  const rawEntry = input.entryConfig ?? {};
  const profile: WeatherTemperatureSignalProfile = rawEntry.profile === 'STRICT' || rawEntry.profile === 'WIDE'
    ? rawEntry.profile
    : 'CORE';
  const profileDefaults = defaultsForProfile(profile);
  const selectionPolicy = rawEntry.selectionPolicy === 'ADJACENT_TOP2' ? 'ADJACENT_TOP2' : 'TOP1';
  const rawRisk = input.riskConfig ?? {};
  const eventBudgetUsd = finite(rawEntry.eventBudgetUsd, DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG.eventBudgetUsd, 1, 200);
  const stationCodes = Array.isArray(rawEntry.stationCodes)
    ? [...new Set(rawEntry.stationCodes.map((value) => String(value).trim().toUpperCase()).filter(Boolean))].slice(0, 10)
    : ['KLGA'];
  const minEntryAsk = finite(rawEntry.minEntryAsk, profileDefaults.minEntryAsk, 0.001, 0.99);
  const maxEntryAsk = finite(rawEntry.maxEntryAsk, profileDefaults.maxEntryAsk, 0.01, 0.999);
  const normalizedEntryRange = minEntryAsk <= maxEntryAsk
    ? { minEntryAsk, maxEntryAsk }
    : { minEntryAsk: profileDefaults.minEntryAsk, maxEntryAsk: profileDefaults.maxEntryAsk };
  return {
    entry: {
      ...DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG,
      ...profileDefaults,
      profile,
      stationCodes: stationCodes.length ? stationCodes : ['KLGA'],
      entryTiming: rawEntry.entryTiming === 'EARLY_DAY' ? 'EARLY_DAY' : 'PRE_DAY',
      selectionPolicy,
      eventBudgetUsd,
      minModelProbability: finite(rawEntry.minModelProbability, profileDefaults.minModelProbability, 0.01, 0.99),
      minEdge: finite(rawEntry.minEdge, profileDefaults.minEdge, 0, 0.99),
      ...normalizedEntryRange,
      maxSpread: finite(rawEntry.maxSpread, profileDefaults.maxSpread, 0.001, 0.5),
      maxEnsembleStdDevF: finite(rawEntry.maxEnsembleStdDevF, profileDefaults.maxEnsembleStdDevF, 0.1, 20),
      minTopAskDepthUsd: finite(rawEntry.minTopAskDepthUsd, DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG.minTopAskDepthUsd, 0, 100_000),
      maxBucketsPerEvent: selectionPolicy === 'ADJACENT_TOP2' ? 2 : 1,
      preDayStartLocalHour: Math.trunc(finite(rawEntry.preDayStartLocalHour, 18, 0, 23)),
      highCutoffLocalHour: Math.trunc(finite(rawEntry.highCutoffLocalHour, 9, 0, 23)),
      lowCutoffLocalHour: Math.trunc(finite(rawEntry.lowCutoffLocalHour, 3, 0, 23)),
      orderTtlSeconds: Math.trunc(finite(rawEntry.orderTtlSeconds, 120, 30, 900)),
    },
    risk: {
      maxOpenExposureUsd: finite(rawRisk.maxOpenExposureUsd, Math.max(100, eventBudgetUsd), eventBudgetUsd, 100_000),
      maxEventsPerDay: Math.trunc(finite(rawRisk.maxEventsPerDay, 3, 1, 50)),
      maxTaskNetLossUsd: nullablePositive(rawRisk.maxTaskNetLossUsd, 100),
      maxTaskNetProfitUsd: nullablePositive(rawRisk.maxTaskNetProfitUsd, null),
    },
  };
}

export const WEATHER_TEMPERATURE_SIMULATION_MATRIX: WeatherTemperatureEntryConfig[] = WEATHER_TEMPERATURE_SIGNAL_PROFILES.flatMap((signal) =>
  (['PRE_DAY', 'EARLY_DAY'] as const).flatMap((entryTiming) =>
    (['TOP1', 'ADJACENT_TOP2'] as const).map((selectionPolicy) => ({
      ...DEFAULT_WEATHER_TEMPERATURE_ENTRY_CONFIG,
      ...signal,
      entryTiming,
      selectionPolicy,
      eventBudgetUsd: 100,
      minTopAskDepthUsd: 0,
      maxBucketsPerEvent: selectionPolicy === 'TOP1' ? 1 : 2,
    })),
  ),
);
