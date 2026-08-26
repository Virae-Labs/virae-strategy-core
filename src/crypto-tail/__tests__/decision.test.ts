import { btc15mSpotContradictsSignal, buildBtc15mGateDiagnostics, decideBtc15mTailEntry, estimateBtc15mWinProbability, resolveBtc15mEntryLimitPrice } from '../decision';
import { REFERENCE_CRYPTO_TAIL_CONFIG_V1 } from '../reference';
import type { Btc15mDecisionInput } from '../types';

function baseInput(overrides: Partial<Btc15mDecisionInput> = {}): Btc15mDecisionInput {
  const nowSec = 1_800_000_880;
  return {
    nowSec,
    round: {
      roundKey: 'btc-updown-15m-1800000000',
      eventSlug: 'btc-updown-15m-1800000000',
      eventTitle: null,
      eventImage: null,
      eventIcon: null,
      marketId: 'market-1',
      marketQuestion: null,
      marketImage: null,
      marketIcon: null,
      upTokenId: 'up-token',
      downTokenId: 'down-token',
      upOutcomeLabel: 'Up',
      downOutcomeLabel: 'Down',
      roundStartSec: 1_800_000_000,
      roundEndSec: 1_800_000_900,
      priceToBeat: null,
      priceToBeatSource: null,
      resolutionPriceModel: null,
      active: true,
      closed: false,
      acceptingOrders: true,
      enableOrderBook: true,
      orderMinSize: 5,
      liquidityClob: 20_000,
      settlementSourceOk: true,
      metadataFresh: true,
    },
    chainlink: {
      startPrice: 100_000,
      currentPrice: 100_120,
      currentPointTs: nowSec,
      fresh: true,
      priceModel: null,
    },
    orderbook: {
      bestAsk: 0.92,
      bestBid: 0.915,
      spread: 0.005,
      topDepthUsd: 100,
      fresh: true,
    },
    config: REFERENCE_CRYPTO_TAIL_CONFIG_V1,
    risk: {
      dailyLossUsd: 0,
      taskNetLossUsd: 0,
      consecutiveLosses: 0,
      tradesToday: 0,
      hasRoundExecution: false,
    },
    global: {
      enabled: true,
      liveTradingEnabled: true,
      maxNotionalUsd: null,
    },
    ...overrides,
  };
}

describe('decideBtc15mTailEntry', () => {
  it('fails closed on non-finite market and configuration values', () => {
    expect(decideBtc15mTailEntry(baseInput({
      orderbook: { ...baseInput().orderbook, bestAsk: Number.NaN },
    }))).toMatchObject({ decision: 'SKIP', reasonCode: 'INVALID_INPUT', limitPrice: null });
    expect(decideBtc15mTailEntry(baseInput({
      config: {
        ...baseInput().config,
        entry: { ...baseInput().config.entry, maxSpread: Number.POSITIVE_INFINITY },
      },
    }))).toMatchObject({ decision: 'SKIP', reasonCode: 'INVALID_INPUT' });
    expect(buildBtc15mGateDiagnostics(baseInput({
      orderbook: { ...baseInput().orderbook, bestAsk: Number.NaN },
    }))).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'input_valid', status: 'fail' }),
    ]));
  });

  it('does not infer a direction when the reference price has zero distance', () => {
    const input = baseInput();
    expect(decideBtc15mTailEntry({
      ...input,
      nowSec: input.round!.roundEndSec - 4,
      chainlink: { ...input.chainlink, currentPrice: input.chainlink.startPrice },
    })).toMatchObject({
      decision: 'WAIT',
      reasonCode: 'SIGNAL_DISTANCE_ZERO',
      distanceBps: 0,
    });
  });

  it('checks venue minimum shares against the final offset limit price', () => {
    const input = baseInput();
    expect(decideBtc15mTailEntry({
      ...input,
      round: { ...input.round!, orderMinSize: 10.1 },
      orderbook: { ...input.orderbook, bestAsk: 0.49, bestBid: 0.485, tickSize: 0.01 },
      config: {
        ...input.config,
        entry: {
          ...input.config.entry,
          minEntryAsk: 0.1,
          askCap: 0.6,
          edgeGateEnabled: false,
          entryAskOffsetTicks: 1,
        },
      },
    })).toMatchObject({
      decision: 'SKIP',
      reasonCode: 'LIMIT_ORDER_SIZE_BELOW_MARKET_MINIMUM',
      limitPrice: 0.5,
    });
  });

  it('keeps an off-grid ask cap from producing an off-grid limit price', () => {
    expect(resolveBtc15mEntryLimitPrice({
      bestAsk: 0.65,
      offsetTicks: 1,
      tickSize: 0.01,
      askCap: 0.655,
    })).toBe(0.65);
  });

  it('rejects rounds without confirmed Chainlink BTC/USD settlement metadata', () => {
    const input = baseInput({
      round: {
        ...baseInput().round!,
        settlementSourceOk: false,
      },
    });

    expect(decideBtc15mTailEntry(input)).toMatchObject({
      decision: 'SKIP',
      reasonCode: 'SETTLEMENT_SOURCE_UNCONFIRMED',
    });
  });

  it('rejects thin top-three ask depth', () => {
    const input = baseInput({
      orderbook: {
        ...baseInput().orderbook,
        topDepthUsd: 10,
      },
    });

    expect(decideBtc15mTailEntry(input)).toMatchObject({
      decision: 'SKIP',
      reasonCode: 'ORDERBOOK_DEPTH_TOO_THIN',
    });
  });

  it('rejects a limit order whose computed shares are below the market minimum', () => {
    const input = baseInput({
      global: { enabled: true, liveTradingEnabled: true, maxNotionalUsd: 1 },
    });

    expect(decideBtc15mTailEntry(input)).toMatchObject({
      decision: 'SKIP',
      reasonCode: 'LIMIT_ORDER_SIZE_BELOW_MARKET_MINIMUM',
      notionalUsd: 1,
      reasonMessage: 'Limit order size 1.09 shares is below the market minimum of 5 shares.',
    });
  });

  it('waits until the selected outcome price reaches the 90c entry floor', () => {
    const input = baseInput({
      orderbook: {
        ...baseInput().orderbook,
        bestAsk: 0.89,
        bestBid: 0.885,
      },
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          edgeGateEnabled: false,
        },
      },
    });

    expect(decideBtc15mTailEntry(input)).toMatchObject({
      decision: 'WAIT',
      reasonCode: 'ASK_BELOW_ENTRY_FLOOR',
    });
  });

  it('uses a task-specific entry floor when deciding eligibility', () => {
    const input = baseInput({
      orderbook: {
        ...baseInput().orderbook,
        bestAsk: 0.91,
        bestBid: 0.905,
      },
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          minEntryAsk: 0.9,
        },
      },
    });

    expect(decideBtc15mTailEntry(input)).toMatchObject({
      decision: 'ELIGIBLE',
      reasonCode: 'ENTRY_READY',
      limitPrice: 0.91,
    });
  });

  it('accepts an exact spread tick boundary despite binary floating-point noise', () => {
    const input = baseInput({
      orderbook: {
        ...baseInput().orderbook,
        bestAsk: 0.95,
        bestBid: 0.94,
        spread: 0.95 - 0.94,
      },
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          maxSpread: 0.01,
          maxSpreadHard: 0.02,
          edgeGateEnabled: false,
        },
      },
    });

    expect(decideBtc15mTailEntry(input)).toMatchObject({
      decision: 'ELIGIBLE',
      reasonCode: 'ENTRY_READY',
    });
    expect(buildBtc15mGateDiagnostics(input)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'spread_target', status: 'pass' }),
    ]));
  });

  it('still rejects a spread that is materially above the configured target', () => {
    const input = baseInput({
      orderbook: {
        ...baseInput().orderbook,
        spread: 0.010001,
      },
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          maxSpread: 0.01,
          maxSpreadHard: 0.02,
          edgeGateEnabled: false,
        },
      },
    });

    expect(decideBtc15mTailEntry(input)).toMatchObject({
      decision: 'SKIP',
      reasonCode: 'SPREAD_ABOVE_TARGET',
    });
  });

  it('waits when the optional open-price distance gate is enabled and too low', () => {
    const input = baseInput({
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          distanceGateEnabled: true,
          minDistancePercent: 0.2,
        },
      },
    });

    expect(decideBtc15mTailEntry(input)).toMatchObject({
      decision: 'WAIT',
      reasonCode: 'DISTANCE_GATE_TOO_LOW',
    });
  });

  it('allows entry when the optional open-price distance gate is enabled and satisfied', () => {
    const input = baseInput({
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          distanceGateEnabled: true,
          minDistancePercent: 0.1,
        },
      },
    });

    expect(decideBtc15mTailEntry(input)).toMatchObject({
      decision: 'ELIGIBLE',
      reasonCode: 'ENTRY_READY',
    });
  });

  it('waits when the enabled absolute open-price distance gate is below its dollar threshold', () => {
    const input = baseInput({
      chainlink: {
        ...baseInput().chainlink,
        currentPrice: 100_029.99,
      },
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          absoluteDistanceGateEnabled: true,
        },
      },
    });

    expect(decideBtc15mTailEntry(input)).toMatchObject({
      decision: 'WAIT',
      reasonCode: 'ABSOLUTE_DISTANCE_TOO_LOW',
    });
  });

  it('allows entry at the absolute open-price distance threshold', () => {
    const input = baseInput({
      chainlink: {
        ...baseInput().chainlink,
        currentPrice: 99_970,
      },
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          edgeGateEnabled: false,
        },
      },
    });

    expect(decideBtc15mTailEntry(input)).toMatchObject({
      decision: 'ELIGIBLE',
      reasonCode: 'ENTRY_READY',
      candidateOutcome: 'Down',
    });
  });

  it('allows the absolute open-price distance gate to be disabled', () => {
    const input = baseInput({
      chainlink: {
        ...baseInput().chainlink,
        currentPrice: 100_001,
      },
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          absoluteDistanceGateEnabled: false,
          edgeGateEnabled: false,
        },
      },
    });

    expect(decideBtc15mTailEntry(input)).toMatchObject({
      decision: 'ELIGIBLE',
      reasonCode: 'ENTRY_READY',
    });
  });

  it('waits when the selected outcome price is above the entry cap', () => {
    const input = baseInput({
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          askCap: 0.90,
          edgeGateEnabled: false,
        },
      },
    });

    expect(decideBtc15mTailEntry(input)).toMatchObject({
      decision: 'WAIT',
      reasonCode: 'ASK_ABOVE_ENTRY_CAP',
    });
  });

  it('keeps the estimated-edge gate disabled by default', () => {
    const result = decideBtc15mTailEntry(baseInput());

    expect(result).toMatchObject({
      decision: 'ELIGIBLE',
      reasonCode: 'ENTRY_READY',
      candidateOutcome: 'Up',
      selectedTokenId: 'up-token',
    });
    expect(result.limitPrice).toBeGreaterThan(REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry.minEntryAsk);
  });

  it('waits before a task-specific entry time range', () => {
    const result = decideBtc15mTailEntry(baseInput({
      nowSec: 1_800_000_869,
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          entryWindowStartSeconds: 30,
          entryWindowEndSeconds: 15,
        },
      },
    }));

    expect(result).toMatchObject({ decision: 'WAIT', reasonCode: 'BEFORE_DECISION_WINDOW', secondsToEnd: 31 });
  });

  it('stops after a task-specific entry time range', () => {
    const result = decideBtc15mTailEntry(baseInput({
      nowSec: 1_800_000_886,
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          entryWindowStartSeconds: 30,
          entryWindowEndSeconds: 15,
        },
      },
    }));

    expect(result).toMatchObject({ decision: 'SKIP', reasonCode: 'AFTER_ENTRY_WINDOW', secondsToEnd: 14 });
  });

  it('rejects an entry time that is not covered by a configured threshold', () => {
    const result = decideBtc15mTailEntry(baseInput({
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          entryWindowStartSeconds: 30,
          entryWindowEndSeconds: 15,
          entryWindows: [{ secondsToEndMin: 30, minDistanceBps: 0 }],
        },
      },
    }));

    expect(result).toMatchObject({ decision: 'SKIP', reasonCode: 'NO_THRESHOLD_FOR_WINDOW', secondsToEnd: 20 });
  });

  it('enforces the distance threshold selected by the current entry window', () => {
    const result = decideBtc15mTailEntry(baseInput({
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          entryWindows: [{ secondsToEndMin: 16, minDistanceBps: 20 }],
        },
      },
    }));

    expect(result).toMatchObject({ decision: 'WAIT', reasonCode: 'DISTANCE_TOO_SMALL' });
    expect(result.distanceBps).toBeCloseTo(12);
  });

  it('waits when the estimated-edge gate is enabled and the edge is too low', () => {
    const result = decideBtc15mTailEntry(baseInput({
      orderbook: {
        ...baseInput().orderbook,
        bestAsk: 0.95,
        bestBid: 0.945,
      },
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          edgeGateEnabled: true,
        },
      },
    }));

    expect(result).toMatchObject({
      decision: 'WAIT',
      reasonCode: 'EDGE_TOO_SMALL',
      candidateOutcome: 'Up',
      selectedTokenId: 'up-token',
      limitPrice: 0.95,
    });
    expect(result.edge).toBeLessThan(0.015);
  });

  it('allows entry when the optional estimated-edge gate is enabled and satisfied', () => {
    const result = decideBtc15mTailEntry(baseInput({
      orderbook: {
        ...baseInput().orderbook,
        bestAsk: 0.91,
        bestBid: 0.905,
      },
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          minEntryAsk: 0.9,
          edgeGateEnabled: true,
          minEdgeBps: 150,
        },
      },
    }));

    expect(result).toMatchObject({ decision: 'ELIGIBLE', reasonCode: 'ENTRY_READY' });
    expect(result.edge).toBeGreaterThanOrEqual(0.015);
  });

  it('keeps strategy entry decisions independent from the live execution gate', () => {
    const result = decideBtc15mTailEntry(baseInput({
      global: {
        ...baseInput().global,
        liveTradingEnabled: false,
      },
    }));

    expect(result).toMatchObject({
      decision: 'ELIGIBLE',
      reasonCode: 'ENTRY_READY',
      selectedTokenId: 'up-token',
    });
  });

  it('blocks new entries when the task net loss stop is active', () => {
    const result = decideBtc15mTailEntry(baseInput({
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        risk: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.risk,
          maxTaskNetLossUsd: 7.5,
        },
      },
      risk: {
        ...baseInput().risk,
        taskNetLossUsd: 7.5,
      },
    }));

    expect(result).toMatchObject({
      decision: 'SKIP',
      reasonCode: 'TASK_NET_LOSS_STOP',
    });
  });

  it('ignores the legacy global enabled database flag for entry decisions', () => {
    const result = decideBtc15mTailEntry(baseInput({
      global: {
        ...baseInput().global,
        enabled: false,
      },
    }));

    expect(result).toMatchObject({
      decision: 'ELIGIBLE',
      reasonCode: 'ENTRY_READY',
      selectedTokenId: 'up-token',
    });
  });
});

describe('resolveBtc15mEntryLimitPrice', () => {
  it('returns bestAsk unchanged when offsetTicks is 0 (existing-task behavior)', () => {
    expect(resolveBtc15mEntryLimitPrice({ bestAsk: 0.82, offsetTicks: 0, tickSize: 0.01, askCap: 0.9 })).toBe(0.82);
  });

  it('returns bestAsk unchanged when tickSize is missing', () => {
    expect(resolveBtc15mEntryLimitPrice({ bestAsk: 0.82, offsetTicks: 2, tickSize: null, askCap: 0.9 })).toBe(0.82);
    expect(resolveBtc15mEntryLimitPrice({ bestAsk: 0.82, offsetTicks: 2, tickSize: 0, askCap: 0.9 })).toBe(0.82);
  });

  it('lifts the price by offsetTicks * tickSize onto the tick grid', () => {
    expect(resolveBtc15mEntryLimitPrice({ bestAsk: 0.82, offsetTicks: 1, tickSize: 0.01, askCap: 0.9 })).toBeCloseTo(0.83, 10);
    expect(resolveBtc15mEntryLimitPrice({ bestAsk: 0.82, offsetTicks: 2, tickSize: 0.01, askCap: 0.9 })).toBeCloseTo(0.84, 10);
    expect(resolveBtc15mEntryLimitPrice({ bestAsk: 0.82, offsetTicks: 1, tickSize: 0.001, askCap: 0.9 })).toBeCloseTo(0.821, 10);
  });

  it('never exceeds askCap', () => {
    expect(resolveBtc15mEntryLimitPrice({ bestAsk: 0.895, offsetTicks: 1, tickSize: 0.01, askCap: 0.9 })).toBeCloseTo(0.9, 10);
    expect(resolveBtc15mEntryLimitPrice({ bestAsk: 0.899, offsetTicks: 2, tickSize: 0.01, askCap: 0.9 })).toBeCloseTo(0.9, 10);
  });
});

describe('btc15mSpotContradictsSignal', () => {
  // twapPrice = the trailing-TWAP lead vs start (100_000); spotPrice = live spot.
  const call = (twapPrice: number, spotPrice: number | null, minContradictionBps = 1.5) =>
    btc15mSpotContradictsSignal({ startPrice: 100_000, twapPrice, spotPrice, minContradictionBps });

  it('is false when there is no spot price to compare', () => {
    expect(call(99_960, null)).toBe(false);
  });

  it('flags a Down lead when live spot has risen above the TWAP', () => {
    // TWAP Down (99_960 < start), spot 99_980 above TWAP by +20 (2 bps) -> reversing up
    expect(call(99_960, 99_980)).toBe(true);
  });

  it('flags an Up lead when live spot has fallen below the TWAP', () => {
    // TWAP Up (100_040 > start), spot 100_020 below TWAP by -20 (2 bps) -> reversing down
    expect(call(100_040, 100_020)).toBe(true);
  });

  it('passes when spot agrees with the lead (Down lead, spot below TWAP)', () => {
    expect(call(99_960, 99_940)).toBe(false);
  });

  it('passes when spot agrees with the lead (Up lead, spot above TWAP)', () => {
    expect(call(100_040, 100_060)).toBe(false);
  });

  it('ignores spot divergence below the bps threshold', () => {
    // Down lead, spot 99_970 above TWAP by +10 (1 bp) < 1.5 -> not flagged
    expect(call(99_960, 99_970)).toBe(false);
  });
});

describe('decideBtc15mTailEntry consistency gate', () => {
  // baseInput has an Up lead (TWAP current 100_120 > start 100_000). Spot below the
  // TWAP means live is falling back = reversing the Up lead.
  it('waits with SIGNAL_MOMENTUM_CONTRADICTION when enabled and spot opposes the lead', () => {
    const base = baseInput();
    const result = decideBtc15mTailEntry({
      ...base,
      chainlink: { ...base.chainlink, spotPrice: 100_100 },
      config: { ...base.config, entry: { ...base.config.entry, consistencyGateEnabled: true } },
    });
    expect(result.decision).toBe('WAIT');
    expect(result.reasonCode).toBe('SIGNAL_MOMENTUM_CONTRADICTION');
  });

  it('does not trigger when the gate is disabled (default)', () => {
    const base = baseInput();
    const result = decideBtc15mTailEntry({ ...base, chainlink: { ...base.chainlink, spotPrice: 100_100 } });
    expect(result.reasonCode).not.toBe('SIGNAL_MOMENTUM_CONTRADICTION');
  });

  it('passes when spot agrees with the lead', () => {
    const base = baseInput();
    const result = decideBtc15mTailEntry({
      ...base,
      chainlink: { ...base.chainlink, spotPrice: 100_160 }, // live above the TWAP, extending the Up lead
      config: { ...base.config, entry: { ...base.config.entry, consistencyGateEnabled: true } },
    });
    expect(result.reasonCode).not.toBe('SIGNAL_MOMENTUM_CONTRADICTION');
  });
});

describe('estimateBtc15mWinProbability', () => {
  const winProb = (secondsToEnd: number, windowSeconds?: number | null) =>
    estimateBtc15mWinProbability({ distanceBps: 0, requiredDistanceBps: 0, secondsToEnd, windowSeconds });

  describe('spot / non-TWAP path (no window)', () => {
    it('reproduces the legacy seconds-to-end time ladder when no window is provided', () => {
      expect(winProb(10)).toBeCloseTo(0.95, 6); // s<=12 => +0.05
      expect(winProb(14)).toBeCloseTo(0.94, 6); // s<=15 => +0.04
      expect(winProb(25)).toBeCloseTo(0.925, 6); // s<=30 => +0.025
      expect(winProb(40)).toBeCloseTo(0.912, 6); // s<=45 => +0.012
      expect(winProb(100)).toBeCloseTo(0.9, 6); // else   => +0
    });

    it('is unchanged when windowSeconds is explicitly null', () => {
      expect(winProb(10, null)).toBeCloseTo(0.95, 6);
    });
  });

  describe('TWAP path', () => {
    it('scales the time bump by the fraction of the settlement window already elapsed (60s)', () => {
      // f = clamp(1 - secondsToEnd / 60, 0, 1); timeComponent = 0.05 * f
      expect(winProb(60, 60)).toBeCloseTo(0.9, 6); // f=0
      expect(winProb(45, 60)).toBeCloseTo(0.9125, 6); // f=0.25 => +0.0125
      expect(winProb(30, 60)).toBeCloseTo(0.925, 6); // f=0.5  => +0.025
      expect(winProb(6, 60)).toBeCloseTo(0.945, 6); // f=0.9  => +0.045
    });

    it('gives zero time bump before the settlement window opens (30s)', () => {
      expect(winProb(45, 30)).toBeCloseTo(0.9, 6); // s=45 > W=30 => f=0
      expect(winProb(30, 30)).toBeCloseTo(0.9, 6); // s=30 == W  => f=0
    });

    it('rises monotonically as the round approaches close (30s)', () => {
      expect(winProb(15, 30)).toBeCloseTo(0.925, 6); // f=0.5 => +0.025
      expect(winProb(6, 30)).toBeCloseTo(0.94, 6); // f=0.8  => +0.04
      expect(winProb(3, 30)).toBeCloseTo(0.945, 6); // f=0.9 => +0.045
      expect(winProb(15, 30)).toBeLessThan(winProb(3, 30));
    });

    it('still layers the distance component and honors the 0.99 cap', () => {
      // f = 1 - 30/60 = 0.5 => timeComponent 0.025; distanceExcess 500 => min(0.08, 1) = 0.08
      // 0.90 + 0.08 + 0.025 = 1.005 -> capped at 0.99
      expect(
        estimateBtc15mWinProbability({ distanceBps: 500, requiredDistanceBps: 0, secondsToEnd: 30, windowSeconds: 60 }),
      ).toBeCloseTo(0.99, 6);
    });
  });
});

describe('buildBtc15mGateDiagnostics', () => {
  it('marks core gates as passed for an eligible live signal', () => {
    const diagnostics = buildBtc15mGateDiagnostics(baseInput());
    const byKey = new Map(diagnostics.map((item) => [item.key, item]));

    expect(byKey.get('round_available')).toMatchObject({ status: 'pass' });
    expect(byKey.has('global_enabled')).toBe(false);
    expect(byKey.get('entry_window')).toMatchObject({ status: 'pass' });
    expect(byKey.get('distance_threshold')).toMatchObject({ status: 'pass' });
    expect(byKey.get('distance_entry_gate')).toMatchObject({ status: 'pass', expected: 'disabled' });
    expect(byKey.get('absolute_distance_entry_gate')).toMatchObject({ status: 'pass', expected: 'disabled' });
    expect(byKey.get('entry_price_floor')).toMatchObject({ status: 'pass' });
    expect(byKey.get('entry_price_cap')).toMatchObject({ status: 'pass' });
    expect(byKey.get('estimated_edge')).toMatchObject({ status: 'pass', expected: '>= 150 bps' });
  });

  it('marks the estimated-edge diagnostic failed when the enabled threshold is missed', () => {
    const diagnostics = buildBtc15mGateDiagnostics(baseInput({
      orderbook: {
        ...baseInput().orderbook,
        bestAsk: 0.95,
        bestBid: 0.945,
      },
      config: {
        ...REFERENCE_CRYPTO_TAIL_CONFIG_V1,
        entry: {
          ...REFERENCE_CRYPTO_TAIL_CONFIG_V1.entry,
          edgeGateEnabled: true,
        },
      },
    }));

    expect(diagnostics.find((item) => item.key === 'estimated_edge')).toMatchObject({
      status: 'fail',
      expected: '>= 150 bps',
    });
  });

  it('shows the enforced entry-window distance threshold', () => {
    const input = baseInput({
      chainlink: {
        ...baseInput().chainlink,
        currentPrice: 100_010,
      },
    });
    const diagnostics = buildBtc15mGateDiagnostics(input);

    expect(diagnostics.find((item) => item.key === 'distance_threshold')).toMatchObject({
      status: 'pass',
      expected: '>= 0.00 bps',
    });
  });
});
