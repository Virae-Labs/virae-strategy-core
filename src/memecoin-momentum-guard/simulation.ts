import { DEFAULT_MEMECOIN_MOMENTUM_GUARD_CONFIG } from './config';
import { decideMemecoinMomentumEntry, decideMemecoinMomentumExit } from './decision';
import type {
  MemecoinMomentumEntryInput,
  MemecoinMomentumExitInput,
  MemecoinMomentumSimulationResult,
  MemecoinMomentumSimulationScenario,
} from './types';

const NOW = 2_000_000_000;

function entryInput(): MemecoinMomentumEntryInput {
  return {
    nowSec: NOW,
    config: { ...DEFAULT_MEMECOIN_MOMENTUM_GUARD_CONFIG },
    observation: {
      observationId: 'observation-1', capturedAtSec: NOW - 5, venue: 'SOLANA', chainId: 'solana-mainnet',
      tokenAddress: 'So11111111111111111111111111111111111111112', pairAddress: 'pair-1', symbol: 'MEME',
      pairCreatedAtSec: NOW - 86_400, priceUsd: 0.01, priceChange1hPct: 8, volume1hUsd: 10_000,
      volume24hUsd: 100_000, volumeAnomaly: 3, txns1h: 80, txns24h: 500, buys1h: 70, sells1h: 30,
      liquidityUsd: 100_000, riskLevel: 'LOW', dexStatus: 'active', honeypot: false, buyEnabled: true,
      signalTypes: ['momentum_breakout', 'volume_surge', 'buy_pressure'], signalContinuityCount: 2,
      signalLastSeenAtSec: NOW - 5,
    },
    quote: {
      quoteKey: 'quote-1', createdAtSec: NOW - 2, expiresAtSec: NOW + 30, estimatedNotionalUsd: 20,
      priceImpactPct: 0.5, orderPoolRatioPct: 0.02, poolLiquidityUsd: 100_000, sellability: 'VERIFIED',
    },
    risk: { openPositionCount: 0, dailyExecutedNotionalUsd: 0, dailyRealizedPnlUsd: 0, tokenCooldownUntilSec: null, globallyEnabled: true },
  };
}

function exitInput(): MemecoinMomentumExitInput {
  return {
    nowSec: NOW, openedAtSec: NOW - 1_800, costBasisUsd: 20, executableProceedsUsd: 21,
    riskWarning: false, sellRouteAvailable: true,
    config: { takeProfitPct: 20, stopLossPct: 8, maxHoldSec: 7_200 },
  };
}

export function buildMemecoinMomentumGuardSimulationMatrix(): MemecoinMomentumSimulationScenario[] {
  const entry = (id: string, category: MemecoinMomentumSimulationScenario['category'], description: string,
    mutate: (input: MemecoinMomentumEntryInput) => void, decision: string, reasonCode: string) => {
    const input = entryInput(); mutate(input);
    return { id, category, description, entryInput: input, expected: { decision, reasonCode } };
  };
  const exit = (id: string, description: string, mutate: (input: MemecoinMomentumExitInput) => void,
    decision: string, reasonCode: string) => {
    const input = exitInput(); mutate(input);
    return { id, category: 'EXIT' as const, description, exitInput: input, expected: { decision, reasonCode } };
  };
  return [
    entry('entry-ready', 'ENTRY', 'Persistent confirmed momentum with a safe executable quote passes.', () => {}, 'ELIGIBLE', 'ENTRY_READY'),
    entry('signal-not-persistent', 'ENTRY', 'A first observation waits.', (i) => { i.observation.signalContinuityCount = 1; }, 'WAIT', 'SIGNAL_NOT_PERSISTENT'),
    entry('overheated', 'ENTRY', 'An overheated move is not chased.', (i) => { i.observation.priceChange1hPct = 50; }, 'SKIP', 'MOMENTUM_OVERHEATED'),
    entry('security-unavailable', 'DATA_QUALITY', 'Unknown honeypot evidence fails closed.', (i) => { i.observation.honeypot = null; }, 'SKIP', 'SECURITY_UNAVAILABLE'),
    entry('observation-stale', 'DATA_QUALITY', 'A stale observation fails closed.', (i) => { i.observation.capturedAtSec = NOW - 60; }, 'SKIP', 'OBSERVATION_STALE'),
    entry('position-limit', 'RISK', 'Open-position limits block entry.', (i) => { i.risk.openPositionCount = 2; }, 'SKIP', 'POSITION_LIMIT_REACHED'),
    entry('daily-loss-stop', 'RISK', 'Daily realized loss stops new entries.', (i) => { i.risk.dailyRealizedPnlUsd = -20; }, 'SKIP', 'DAILY_LOSS_LIMIT_REACHED'),
    entry('quote-required', 'QUOTE', 'A signal without a quote waits.', (i) => { i.quote = null; }, 'WAIT', 'QUOTE_REQUIRED'),
    entry('quote-expiring', 'QUOTE', 'A nearly expired quote waits.', (i) => { i.quote!.expiresAtSec = NOW + 5; }, 'WAIT', 'QUOTE_EXPIRING'),
    entry('impact-high', 'QUOTE', 'High executable impact is rejected.', (i) => { i.quote!.priceImpactPct = 4; }, 'SKIP', 'PRICE_IMPACT_TOO_HIGH'),
    exit('exit-hold', 'No active exit condition holds.', () => {}, 'HOLD', 'HOLD'),
    exit('exit-take-profit', 'Executable proceeds trigger take profit.', (i) => { i.executableProceedsUsd = 24; }, 'EXIT', 'TAKE_PROFIT'),
    exit('exit-stop-loss', 'Executable proceeds trigger stop loss.', (i) => { i.executableProceedsUsd = 18; }, 'EXIT', 'STOP_LOSS'),
    exit('exit-time-stop', 'Maximum holding time triggers an exit.', (i) => { i.openedAtSec = NOW - 7_200; }, 'EXIT', 'TIME_STOP'),
    exit('exit-risk-stop', 'A fresh risk warning triggers an exit.', (i) => { i.riskWarning = true; }, 'EXIT', 'RISK_STOP'),
  ];
}

export function runMemecoinMomentumGuardSimulationMatrix(
  matrix = buildMemecoinMomentumGuardSimulationMatrix(),
): MemecoinMomentumSimulationResult[] {
  return matrix.map((scenario) => {
    const decision = scenario.entryInput
      ? decideMemecoinMomentumEntry(scenario.entryInput)
      : decideMemecoinMomentumExit(scenario.exitInput!);
    const mismatches: string[] = [];
    if (decision.decision !== scenario.expected.decision) mismatches.push(`decision:${decision.decision}`);
    if (decision.reasonCode !== scenario.expected.reasonCode) mismatches.push(`reason:${decision.reasonCode}`);
    return { scenarioId: scenario.id, category: scenario.category, decision, passed: mismatches.length === 0, mismatches };
  });
}
