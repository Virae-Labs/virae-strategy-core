import type {
  CryptoTailDecisionInput,
  CryptoTailDecisionResult,
  CryptoTailEntryReasonCode,
} from '../crypto-tail';
import type { Btc15mValueSnipeVenue } from './manifest';

export type Btc15mValueSnipeConfig = {
  minEdgeBps: number;
};

export type Btc15mValueSnipeDecisionInput = {
  venue: Btc15mValueSnipeVenue;
  /**
   * Normalized recurring BTC 15m snapshot. The wrapper disables Crypto Tail's
   * embedded fee approximation and applies the explicit venue all-in cost below.
   */
  snapshot: CryptoTailDecisionInput;
  config: Btc15mValueSnipeConfig;
  /** Effective per-winning-share cost after venue fees, host fees and slippage. */
  estimatedAllInCost: number;
};

export type Btc15mValueSnipeReasonCode = CryptoTailEntryReasonCode
  | 'VENUE_PRICE_MODEL_MISMATCH'
  | 'ALL_IN_COST_INVALID'
  | 'VALUE_EDGE_TOO_SMALL';

export type Btc15mValueSnipeDecisionResult = Omit<
  CryptoTailDecisionResult,
  'reasonCode' | 'estimatedAllInCost' | 'edge'
> & {
  venue: Btc15mValueSnipeVenue | null;
  reasonCode: Btc15mValueSnipeReasonCode;
  estimatedAllInCost: number | null;
  edge: number | null;
  edgeBps: number | null;
  underlyingReasonCode: CryptoTailEntryReasonCode | null;
};

export type Btc15mValueSnipeSimulationCategory = 'VALUE_EDGE' | 'DATA_QUALITY' | 'MARKET_GATES';

export type Btc15mValueSnipeSimulationScenario = {
  id: string;
  category: Btc15mValueSnipeSimulationCategory;
  description: string;
  input: Btc15mValueSnipeDecisionInput;
  expected: { decision: string; reasonCode: Btc15mValueSnipeReasonCode };
};

export type Btc15mValueSnipeSimulationRowResult = {
  scenarioId: string;
  category: Btc15mValueSnipeSimulationCategory;
  decision: Btc15mValueSnipeDecisionResult;
  passed: boolean;
  mismatches: string[];
};
