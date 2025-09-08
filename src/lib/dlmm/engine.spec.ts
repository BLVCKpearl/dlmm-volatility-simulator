import { describe, it, expect } from 'vitest';
import { BASIS_POINT_MAX, DlmmConfig } from './schema';
import { priceFromActiveId, minPriceSellX, minPriceSellY, baseFeeRate, variableFeeRate, totalFeeRate, compositionFee, updateVolatilityAccumulator, nextIdWithDepletion, SCALE, OFFSET } from './engine';

const cfg: DlmmConfig = {
  pair: { xSymbol: 'X', ySymbol: 'Y' },
  startingPrices: { xUsd: 100, yUsd: 1 },
  grid: { binStep_bps: 10, rangeBins: { left: -5, right: 5 }, activeId: 0 },
  liquidity: { shape: 'Curve', curveSigma_bins: 16, inventory: { xTotal: 100, yTotal: 100 } },
  fees: { baseFactor_B: 1, baseFeePower: 0, variableControl_A: 1, maxFeeRate: 0.5 },
  runtime: { duration_sec: 60, seed: 1, tradeArrival_lambda_per_sec: 1, tradeSize_lognorm: { mu_log: -1, sigma_log: 1 }, buyProbability: 0.5, forceBinDepletion: true, stream: true },
  advancedDefaults: { volFilter_t_f_sec: 1, volDecay_t_d_sec: 5, decayFactor_R: 0.5 }
};

describe('price formulas', () => {
  it('base price matches geometric factor', () => {
    const p0 = 1;
    const step = cfg.grid.binStep_bps / BASIS_POINT_MAX;
    const factor = 1 + step;
    expect(priceFromActiveId(cfg, 0, p0)).toBeCloseTo(1, 12);
    expect(priceFromActiveId(cfg, 3, p0)).toBeCloseTo(Math.pow(factor, 3), 12);
  });

  it('price impact min-price', () => {
    const spot = 100;
    const bps = 100; // 1%
    expect(minPriceSellX(spot, bps)).toBeCloseTo(spot * (BASIS_POINT_MAX - bps) / BASIS_POINT_MAX, 12);
    expect(minPriceSellY(spot, bps)).toBeCloseTo(spot * BASIS_POINT_MAX / (BASIS_POINT_MAX - bps), 12);
  });
});

describe('fees', () => {
  it('base fee uses factor * bin_step * 10 * 10^power', () => {
    const base = baseFeeRate(cfg);
    const expected = cfg.fees.baseFactor_B * (cfg.grid.binStep_bps / BASIS_POINT_MAX) * 10;
    expect(base).toBeCloseTo(expected, 12);
  });

  it('variable fee uses accumulator term + OFFSET / SCALE', () => {
    const va = 2 * SCALE; // huge accumulator
    const vf = variableFeeRate(va, cfg);
    expect(vf).toBeGreaterThan(0);
  });

  it('total fee capped', () => {
    const t = totalFeeRate(1, 1, cfg);
    expect(t).toBeLessThanOrEqual(cfg.fees.maxFeeRate);
  });

  it('composition fee increases with rate', () => {
    const a = 1000; const r = 0.02;
    expect(compositionFee(a, r)).toBeCloseTo(a * r * (1 + r), 12);
  });
});

describe('volatility accumulator and depletion', () => {
  it('accumulator increases with bins crossed and decays', () => {
    const v1 = updateVolatilityAccumulator(0, 3, 1, null, cfg);
    const v2 = updateVolatilityAccumulator(v1, 0, 3, 0.5, cfg); // within tf: minimal change
    const v3 = updateVolatilityAccumulator(v2, 0, 10, 0.5, cfg); // beyond td: reset
    expect(v1).toBeGreaterThan(0);
    expect(v3).toBe(0);
  });

  it('depletion keeps id frozen outside range', () => {
    const left = -1, right = 1;
    const inside = nextIdWithDepletion(0, 1, left, right, true);
    expect(inside.frozen).toBe(false);
    const out = nextIdWithDepletion(1, 1, left, right, true);
    expect(out.id).toBe(1);
    expect(out.frozen).toBe(true);
  });
});
