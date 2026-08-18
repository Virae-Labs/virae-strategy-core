import type {
  WeatherTemperatureCandidate,
  WeatherTemperatureCandidateEvaluation,
  WeatherTemperatureCandidateReasonCode,
  WeatherTemperatureDiagnosticCode,
  WeatherTemperatureDecision,
  WeatherTemperatureEntryConfig,
  WeatherTemperatureIntent,
  WeatherTemperatureSnapshot,
} from './types';

type LocalClock = { date: string; hour: number };

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function isoDateOffset(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weatherTemperatureLocalClock(timezone: string, now: Date): LocalClock {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, hour: Number(values.hour) };
}

export function weatherTemperatureTimingEligible(
  config: WeatherTemperatureEntryConfig,
  snapshot: Pick<WeatherTemperatureSnapshot, 'targetDate' | 'metric'>,
  clock: LocalClock,
): boolean {
  if (config.entryTiming === 'PRE_DAY') {
    return clock.date === isoDateOffset(snapshot.targetDate, -1) && clock.hour >= config.preDayStartLocalHour;
  }
  const cutoff = snapshot.metric === 'high' ? config.highCutoffLocalHour : config.lowCutoffLocalHour;
  return clock.date === snapshot.targetDate && clock.hour <= cutoff;
}

function edge(candidate: WeatherTemperatureCandidate): number | null {
  return candidate.quote.bestAsk == null ? null : candidate.modelProbability - candidate.quote.bestAsk;
}

export function evaluateWeatherTemperatureCandidate(
  config: WeatherTemperatureEntryConfig,
  candidate: WeatherTemperatureCandidate,
  params: { ensembleStdDevF: number; timingEligible: boolean },
): WeatherTemperatureCandidateEvaluation {
  const candidateEdge = edge(candidate);
  const base = { marketId: candidate.marketId, tokenId: candidate.yesTokenId, edge: candidateEdge };
  const wait = (reasonCode: WeatherTemperatureCandidateReasonCode): WeatherTemperatureCandidateEvaluation => ({ ...base, decision: 'WAIT', reasonCode });
  if (!params.timingEligible) return wait('ENTRY_TIMING_MISMATCH');
  if (params.ensembleStdDevF > config.maxEnsembleStdDevF) return wait('FORECAST_DISPERSION_TOO_HIGH');
  if (!candidate.quote.acceptingOrders) return wait('MARKET_NOT_ACCEPTING_ORDERS');
  if (!candidate.quote.fresh) return wait('ORDERBOOK_STALE');
  if (!Number.isFinite(candidate.modelProbability) || candidate.modelProbability < 0 || candidate.modelProbability > 1) return wait('MODEL_PROBABILITY_INVALID');
  if (candidate.quote.bestAsk == null || candidateEdge == null) return wait('PRICE_UNAVAILABLE');
  if (!Number.isFinite(candidate.quote.bestAsk) || candidate.quote.bestAsk <= 0 || candidate.quote.bestAsk >= 1) return wait('PRICE_OUT_OF_RANGE');
  if (candidate.quote.bestBid != null && (!Number.isFinite(candidate.quote.bestBid) || candidate.quote.bestBid < 0 || candidate.quote.bestBid >= 1)) return wait('BID_OUT_OF_RANGE');
  if (candidate.quote.bestBid != null && candidate.quote.bestBid > candidate.quote.bestAsk) return wait('CROSSED_ORDERBOOK');
  if (candidate.quote.bestAsk < config.minEntryAsk) return wait('ENTRY_ASK_TOO_LOW');
  if (candidate.quote.bestAsk > config.maxEntryAsk) return wait('ENTRY_ASK_TOO_HIGH');
  if (candidate.quote.spread == null || !Number.isFinite(candidate.quote.spread) || candidate.quote.spread < 0) return wait('SPREAD_INVALID');
  if (candidate.quote.spread > config.maxSpread) return wait('SPREAD_TOO_WIDE');
  if (candidate.quote.topAskDepthUsd == null || !Number.isFinite(candidate.quote.topAskDepthUsd) || candidate.quote.topAskDepthUsd < 0) return wait('TOP_ASK_DEPTH_INVALID');
  if (candidate.quote.topAskDepthUsd < config.minTopAskDepthUsd) return wait('TOP_ASK_DEPTH_TOO_LOW');
  if (candidate.quote.minOrderSize == null) return wait('MIN_ORDER_SIZE_UNAVAILABLE');
  if (!Number.isFinite(candidate.quote.minOrderSize) || candidate.quote.minOrderSize <= 0) return wait('MIN_ORDER_SIZE_INVALID');
  if (candidate.modelProbability < config.minModelProbability) return wait('MODEL_PROBABILITY_BELOW_THRESHOLD');
  if (candidateEdge < config.minEdge) return wait('EDGE_BELOW_THRESHOLD');
  return { ...base, decision: 'ENTER', reasonCode: 'ENTRY_ELIGIBLE' };
}

function bucketOrderValue(candidate: WeatherTemperatureCandidate): number {
  return candidate.bucket.lowerBound ?? Number.NEGATIVE_INFINITY;
}

function validInput(
  snapshot: WeatherTemperatureSnapshot,
  config: WeatherTemperatureEntryConfig,
  nowSec: number,
): WeatherTemperatureDiagnosticCode | null {
  if (!Number.isFinite(nowSec)) return 'INVALID_NOW';
  if (!snapshot.eventSlug || !snapshot.forecastRunKey || !snapshot.stationCode) return 'SNAPSHOT_IDENTITY_MISSING';
  if (Number.isNaN(Date.parse(snapshot.capturedAt))) return 'SNAPSHOT_TIME_INVALID';
  if (!validIsoDate(snapshot.targetDate)) return 'TARGET_DATE_INVALID';
  if (!validTimeZone(snapshot.timezone)) return 'TIMEZONE_INVALID';
  if (snapshot.metric !== 'high' && snapshot.metric !== 'low') return 'SNAPSHOT_METRIC_INVALID';
  if (!config.stationCodes.includes(snapshot.stationCode)) return 'STATION_NOT_CONFIGURED';
  if (!snapshot.candidates.length) return 'CANDIDATES_MISSING';
  if (snapshot.candidates.some((candidate) => !candidate.marketId?.trim() || !candidate.yesTokenId?.trim())) return 'CANDIDATE_IDENTITY_MISSING';
  const marketIds = snapshot.candidates.map((candidate) => candidate.marketId);
  const tokenIds = snapshot.candidates.map((candidate) => candidate.yesTokenId);
  if (new Set(marketIds).size !== marketIds.length || new Set(tokenIds).size !== tokenIds.length) return 'CANDIDATE_IDENTITY_DUPLICATED';
  if (snapshot.candidates.some((candidate) => {
    const { lowerBound, upperBound } = candidate.bucket;
    return !candidate.bucket.label?.trim()
      || (lowerBound != null && !Number.isFinite(lowerBound))
      || (upperBound != null && !Number.isFinite(upperBound))
      || (lowerBound != null && upperBound != null && lowerBound > upperBound);
  })) return 'CANDIDATE_BUCKET_INVALID';
  if (!Number.isInteger(snapshot.ensembleMemberCount) || snapshot.ensembleMemberCount < 0) return 'FORECAST_MEMBER_COUNT_INVALID';
  if (snapshot.ensembleMemberCount < 10) return 'FORECAST_MEMBER_COUNT_TOO_LOW';
  if (!Number.isFinite(snapshot.ensembleStdDevF) || snapshot.ensembleStdDevF < 0) return 'FORECAST_DISPERSION_INVALID';
  if (!Number.isFinite(config.eventBudgetUsd) || config.eventBudgetUsd <= 0) return 'EVENT_BUDGET_INVALID';
  if (
    !Number.isFinite(config.minModelProbability)
    || !Number.isFinite(config.minEdge)
    || !Number.isFinite(config.minEntryAsk)
    || !Number.isFinite(config.maxEntryAsk)
    || !Number.isFinite(config.maxSpread)
    || !Number.isFinite(config.maxEnsembleStdDevF)
    || !Number.isFinite(config.minTopAskDepthUsd)
    || !Number.isFinite(config.preDayStartLocalHour)
    || !Number.isFinite(config.highCutoffLocalHour)
    || !Number.isFinite(config.lowCutoffLocalHour)
    || !Number.isFinite(config.orderTtlSeconds)
    || !Array.isArray(config.stationCodes)
    || config.stationCodes.length === 0
    || config.minModelProbability < 0
    || config.minModelProbability > 1
    || config.minEdge < 0
    || config.minEntryAsk <= 0
    || config.maxEntryAsk >= 1
    || config.minEntryAsk > config.maxEntryAsk
    || config.maxSpread < 0
    || config.maxEnsembleStdDevF < 0
    || config.minTopAskDepthUsd < 0
    || ![1, 2].includes(config.maxBucketsPerEvent)
    || ![config.preDayStartLocalHour, config.highCutoffLocalHour, config.lowCutoffLocalHour].every((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23)
    || !Number.isInteger(config.orderTtlSeconds)
    || config.orderTtlSeconds <= 0
  ) return 'CONFIG_INVALID';
  return null;
}

export function decideWeatherTemperatureEntry(params: {
  snapshot: WeatherTemperatureSnapshot;
  config: WeatherTemperatureEntryConfig;
  nowSec: number;
}): WeatherTemperatureDecision {
  const inputError = validInput(params.snapshot, params.config, params.nowSec);
  if (inputError) return { intents: [], evaluations: [], reasonCode: 'INVALID_INPUT', diagnostics: [inputError] };
  const clock = weatherTemperatureLocalClock(params.snapshot.timezone, new Date(params.nowSec * 1_000));
  const timingEligible = weatherTemperatureTimingEligible(params.config, params.snapshot, clock);
  const evaluations = params.snapshot.candidates.map((candidate) =>
    evaluateWeatherTemperatureCandidate(params.config, candidate, {
      ensembleStdDevF: params.snapshot.ensembleStdDevF,
      timingEligible,
    }));
  const evaluationByMarket = new Map(evaluations.map((evaluation) => [evaluation.marketId, evaluation]));
  const eligible = params.snapshot.candidates
    .filter((candidate) => evaluationByMarket.get(candidate.marketId)?.decision === 'ENTER')
    .sort((left, right) => Number(edge(right) ?? 0) - Number(edge(left) ?? 0));
  let selected = eligible.slice(0, 1);
  if (params.config.selectionPolicy === 'ADJACENT_TOP2' && params.config.maxBucketsPerEvent >= 2 && eligible.length > 1) {
    const ordered = [...params.snapshot.candidates].sort((left, right) => bucketOrderValue(left) - bucketOrderValue(right));
    const anchorIndex = ordered.findIndex((candidate) => candidate.marketId === eligible[0].marketId);
    const neighborIds = new Set([ordered[anchorIndex - 1]?.marketId, ordered[anchorIndex + 1]?.marketId]);
    const neighbor = eligible.find((candidate) => neighborIds.has(candidate.marketId));
    if (neighbor) selected = [eligible[0], neighbor];
  }
  const probabilityTotal = selected.reduce((sum, candidate) => sum + candidate.modelProbability, 0);
  let allocatedCents = 0;
  const intents: WeatherTemperatureIntent[] = selected.map((candidate, index) => {
    const budgetCents = Math.round(params.config.eventBudgetUsd * 100);
    const allocationCents = index === selected.length - 1
      ? budgetCents - allocatedCents
      : Math.round(budgetCents * candidate.modelProbability / probabilityTotal);
    allocatedCents += allocationCents;
    const allocation = allocationCents / 100;
    const limitPrice = candidate.quote.bestAsk!;
    return {
      intentKey: `${params.snapshot.eventSlug}:${params.snapshot.forecastRunKey}:${candidate.marketId}:${candidate.yesTokenId}`,
      eventSlug: params.snapshot.eventSlug,
      forecastRunKey: params.snapshot.forecastRunKey,
      marketId: candidate.marketId,
      tokenId: candidate.yesTokenId,
      outcomeLabel: `${candidate.bucket.label} Yes`,
      side: 'BUY',
      orderType: 'LIMIT',
      amountKind: 'NOTIONAL',
      amount: Math.round(allocation * 100) / 100,
      limitPrice,
      ttlSeconds: params.config.orderTtlSeconds,
      rank: index + 1,
      modelProbability: candidate.modelProbability,
      edge: candidate.modelProbability - limitPrice,
      reason: 'Weather ensemble probability exceeds the live market ask by the configured edge.',
    };
  });
  const undersizedMarketIds = new Set(intents.flatMap((intent) => {
    const candidate = selected.find((row) => row.marketId === intent.marketId);
    return candidate && intent.amount / intent.limitPrice + Number.EPSILON < candidate.quote.minOrderSize!
      ? [intent.marketId]
      : [];
  }));
  if (undersizedMarketIds.size) {
    return {
      intents: [],
      evaluations: evaluations.map((evaluation) => undersizedMarketIds.has(evaluation.marketId)
        ? { ...evaluation, decision: 'WAIT', reasonCode: 'ORDER_SIZE_BELOW_MARKET_MINIMUM' }
        : evaluation),
      reasonCode: 'NO_ELIGIBLE_BUCKET',
      diagnostics: ['ORDER_SIZE_BELOW_MARKET_MINIMUM'],
    };
  }
  return {
    intents,
    evaluations,
    reasonCode: intents.length ? 'ENTRY_INTENTS' : 'NO_ELIGIBLE_BUCKET',
    diagnostics: timingEligible ? [] : ['ENTRY_TIMING_MISMATCH'],
  };
}
