import { DEFAULT_MEMECOIN_LAUNCH_SCOUT_CONFIG } from './config';
import { decideMemecoinLaunchEntry, decideMemecoinLaunchExit } from './decision';
import type { MemecoinLaunchEntryInput, MemecoinLaunchExitInput, MemecoinLaunchSimulationResult, MemecoinLaunchSimulationScenario } from './types';

const NOW = 2_000_000_000;
function entryInput(): MemecoinLaunchEntryInput { return { nowSec: NOW, config: { ...DEFAULT_MEMECOIN_LAUNCH_SCOUT_CONFIG }, observation: { observationId: 'launch-1', capturedAtSec: NOW - 3, venue: 'SOLANA', chainId: 'solana-mainnet', tokenAddress: 'So11111111111111111111111111111111111111112', pairAddress: 'pair-1', symbol: 'NEW', pairCreatedAtSec: NOW - 300, priceUsd: 0.001, priceChange5mPct: 25, volume5mUsd: 12_000, txns5m: 100, buys5m: 70, sells5m: 30, liquidityUsd: 60_000, top10HolderPct: 30, devHolderPct: 5, riskLevel: 'LOW', dexStatus: 'active', honeypot: false, buyEnabled: true }, quote: { quoteKey: 'quote-1', createdAtSec: NOW - 2, expiresAtSec: NOW + 30, estimatedNotionalUsd: 10, priceImpactPct: 0.5, orderPoolRatioPct: 0.02, poolLiquidityUsd: 60_000, sellability: 'VERIFIED' }, risk: { openPositionCount: 0, dailyExecutedNotionalUsd: 0, dailyRealizedPnlUsd: 0, tokenCooldownUntilSec: null, globallyEnabled: true } }; }
function exitInput(): MemecoinLaunchExitInput { return { nowSec: NOW, openedAtSec: NOW - 120, costBasisUsd: 10, executableProceedsUsd: 10.1, riskWarning: false, sellRouteAvailable: true, config: { takeProfitPct: 12, minHoldSec: 180, minProfitAfterHoldPct: 2, stopLossPct: 8, maxHoldSec: 480 } }; }

export function buildMemecoinLaunchScoutSystemSimulationMatrix(): MemecoinLaunchSimulationScenario[] {
  const entry = (id: string, category: MemecoinLaunchSimulationScenario['category'], description: string, mutate: (input: MemecoinLaunchEntryInput) => void, decision: string, reasonCode: string) => { const input = entryInput(); mutate(input); return { id, category, description, entryInput: input, expected: { decision, reasonCode } }; };
  const exit = (id: string, description: string, mutate: (input: MemecoinLaunchExitInput) => void, decision: string, reasonCode: string) => { const input = exitInput(); mutate(input); return { id, category: 'EXIT' as const, description, exitInput: input, expected: { decision, reasonCode } }; };
  return [
    entry('entry-ready', 'ENTRY', 'A safe, active launch with a round-trip quote passes.', () => {}, 'ELIGIBLE', 'ENTRY_READY'),
    entry('pair-too-new', 'ENTRY', 'The initial discovery delay waits.', (i) => { i.observation.pairCreatedAtSec = NOW - 20; }, 'WAIT', 'PAIR_TOO_NEW'),
    entry('pair-too-old', 'ENTRY', 'Pools outside the launch window are skipped.', (i) => { i.observation.pairCreatedAtSec = NOW - 1_000; }, 'SKIP', 'PAIR_TOO_OLD'),
    entry('early-activity-low', 'ENTRY', 'Thin early participation waits.', (i) => { i.observation.txns5m = 10; }, 'WAIT', 'EARLY_ACTIVITY_TOO_LOW'),
    entry('buy-pressure-low', 'ENTRY', 'Weak buy participation waits.', (i) => { i.observation.buys5m = 40; i.observation.sells5m = 60; }, 'WAIT', 'BUY_PRESSURE_TOO_LOW'),
    entry('launch-overheated', 'ENTRY', 'An overheated launch is not chased.', (i) => { i.observation.priceChange5mPct = 100; }, 'SKIP', 'LAUNCH_OVERHEATED'),
    entry('security-unavailable', 'DATA_QUALITY', 'Missing honeypot evidence fails closed.', (i) => { i.observation.honeypot = null; }, 'SKIP', 'SECURITY_UNAVAILABLE'),
    entry('holder-data-unavailable', 'DATA_QUALITY', 'Missing developer holding evidence fails closed.', (i) => { i.observation.devHolderPct = null; }, 'SKIP', 'HOLDER_DATA_UNAVAILABLE'),
    entry('observation-stale', 'DATA_QUALITY', 'Stale launch data fails closed.', (i) => { i.observation.capturedAtSec = NOW - 30; }, 'SKIP', 'OBSERVATION_STALE'),
    entry('position-limit', 'RISK', 'Open-position limits block another lottery entry.', (i) => { i.risk.openPositionCount = 3; }, 'SKIP', 'POSITION_LIMIT_REACHED'),
    entry('daily-loss-stop', 'RISK', 'Daily realized losses stop entries.', (i) => { i.risk.dailyRealizedPnlUsd = -15; }, 'SKIP', 'DAILY_LOSS_LIMIT_REACHED'),
    entry('quote-required', 'QUOTE', 'A candidate without round-trip evidence waits.', (i) => { i.quote = null; }, 'WAIT', 'QUOTE_REQUIRED'),
    entry('quote-expiring', 'QUOTE', 'A nearly expired quote waits.', (i) => { i.quote!.expiresAtSec = NOW + 5; }, 'WAIT', 'QUOTE_EXPIRING'),
    entry('impact-high', 'QUOTE', 'High executable impact is rejected.', (i) => { i.quote!.priceImpactPct = 5; }, 'SKIP', 'PRICE_IMPACT_TOO_HIGH'),
    entry('sellability-unverified', 'QUOTE', 'An unverified reverse route is rejected.', (i) => { i.quote!.sellability = 'UNVERIFIED'; }, 'SKIP', 'SELLABILITY_UNVERIFIED'),
    exit('exit-hold', 'A small early gain remains open before minimum hold.', () => {}, 'HOLD', 'HOLD'),
    exit('exit-take-profit', 'A fast large gain exits immediately.', (i) => { i.executableProceedsUsd = 11.2; }, 'EXIT', 'TAKE_PROFIT'),
    exit('exit-profit-after-hold', 'A smaller net gain exits after minimum hold.', (i) => { i.openedAtSec = NOW - 180; i.executableProceedsUsd = 10.2; }, 'EXIT', 'PROFIT_AFTER_MIN_HOLD'),
    exit('exit-stop-loss', 'Loss protection exits before the deadline.', (i) => { i.executableProceedsUsd = 9.2; }, 'EXIT', 'STOP_LOSS'),
    exit('exit-time-stop', 'The deadline exits even a losing position.', (i) => { i.openedAtSec = NOW - 480; i.executableProceedsUsd = 9.7; }, 'EXIT', 'TIME_STOP'),
    exit('exit-risk-stop', 'Fresh risk evidence exits immediately.', (i) => { i.riskWarning = true; }, 'EXIT', 'RISK_STOP'),
  ];
}

export function runMemecoinLaunchScoutSystemSimulationMatrix(matrix = buildMemecoinLaunchScoutSystemSimulationMatrix()): MemecoinLaunchSimulationResult[] { return matrix.map((scenario) => { const decision = scenario.entryInput ? decideMemecoinLaunchEntry(scenario.entryInput) : decideMemecoinLaunchExit(scenario.exitInput!); const mismatches: string[] = []; if (decision.decision !== scenario.expected.decision) mismatches.push(`decision:${decision.decision}`); if (decision.reasonCode !== scenario.expected.reasonCode) mismatches.push(`reason:${decision.reasonCode}`); return { scenarioId: scenario.id, category: scenario.category, decision, passed: mismatches.length === 0, mismatches }; }); }
