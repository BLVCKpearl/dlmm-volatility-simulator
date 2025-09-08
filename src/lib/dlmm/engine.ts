import { BASIS_POINT_MAX, DlmmConfig } from "./schema";

// Meteora base price formula: price = (1 + bin_step / BASIS_POINT_MAX) ^ active_id
export function priceFromActiveId(cfg: DlmmConfig, activeId: number, basePrice: number) {
  const step = Math.max(0, cfg.grid.binStep_bps) / BASIS_POINT_MAX;
  const factor = 1 + step;
  return basePrice * Math.pow(factor, activeId);
}

// ---------------------------------------------
// Bin-local, DLMM-style execution (helpers only)
// ---------------------------------------------

// Price of arbitrary index j on a multiplicative grid with mid at j=0
export function indexToPrice(cfg: Pick<DlmmConfig, 'grid'>, j: number, P0: number): number {
  const step = Math.max(0, cfg.grid.binStep_bps) / BASIS_POINT_MAX;
  const r = 1 + step;
  return P0 * Math.pow(r, j);
}

export type Bin = {
  xBase: number;   // base token inventory in this bin
  yQuote: number;  // quote token inventory in this bin
  feeAccruedBase: number;
  feeAccruedQuote: number;
};

export type FeeDirection = 'BUY' | 'SELL';
export type FeeProvider = (args: { j: number; direction: FeeDirection; bin: Bin }) => number; // decimal 0..1

// Simple Gaussian seeding for inventories across [left..right]
export function seedBinsGaussian(cfg: DlmmConfig, P0: number, opts?: { sigma_bins?: number }): Bin[] {
  const left = cfg.grid.rangeBins.left;
  const right = cfg.grid.rangeBins.right;
  const sigma = Math.max(1e-6, opts?.sigma_bins ?? cfg.liquidity.curveSigma_bins);
  const n = right - left + 1;
  const weights: number[] = [];
  for (let j = left; j <= right; j++) {
    const z = j / sigma; // centered at 0 (mid index assumed 0)
    weights.push(Math.exp(-0.5 * z * z));
  }
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const X = Math.max(0, cfg.liquidity.inventory.xTotal);
  const Y = Math.max(0, cfg.liquidity.inventory.yTotal);
  const bins: Bin[] = [];
  for (let k = 0; k < n; k++) {
    const w = weights[k] / sumW;
    bins.push({ xBase: X * w, yQuote: Y * w, feeAccruedBase: 0, feeAccruedQuote: 0 });
  }
  return bins;
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

export function buyBaseWithQuote(params: {
  cfg: DlmmConfig;
  P0: number;
  bins: Bin[];                 // array for [left..right]
  activeId: number;            // current index (absolute j)
  desiredBaseOut: number;      // user wants Δbase
  feeProvider?: FeeProvider;   // returns decimal fee per-bin
  feeMin?: number;
  feeMax?: number;
  tol?: number;
}): { newActiveId: number; baseOut: number; quoteIn: number; feeTotalQuote: number; crossed: number; outOfRange: boolean } {
  const { cfg, P0, bins, desiredBaseOut } = params;
  const left = cfg.grid.rangeBins.left;
  const right = cfg.grid.rangeBins.right;
  const idx = (j: number) => j - left;
  let j = params.activeId;
  let remaining = Math.max(0, desiredBaseOut);
  const rtol = params.tol ?? 1e-12;
  const feeMin = params.feeMin ?? 0;
  const feeMax = params.feeMax ?? cfg.fees.maxFeeRate;
  const feeProvider = params.feeProvider ?? (() => clamp(cfg.fees.baseFactor_B * (cfg.grid.binStep_bps / BASIS_POINT_MAX) * 10, feeMin, feeMax));

  let baseOut = 0; let quoteIn = 0; let feeTotalQuote = 0; let crossed = 0; let outOfRange = false;

  while (remaining > rtol) {
    if (j < left) j = left;
    if (j > right) { outOfRange = true; break; }
    // Skip empties (sellable side yQuote)
    while (j <= right && bins[idx(j)] && bins[idx(j)].yQuote <= rtol) { j++; crossed++; }
    if (j > right) { outOfRange = true; break; }
    const b = bins[idx(j)]; if (!b) { outOfRange = true; break; }
    const Pj = indexToPrice(cfg, j, P0);
    const xMax = b.yQuote / Pj;
    if (xMax <= rtol) { j++; crossed++; continue; }
    const take = Math.min(remaining, xMax);
    const dQuote = take * Pj;
    const fr = clamp(feeProvider({ j, direction: 'BUY', bin: b }), feeMin, feeMax);
    const fee = dQuote * fr;
    b.yQuote -= dQuote;
    b.feeAccruedQuote += fee;
    baseOut += take; quoteIn += dQuote + fee; feeTotalQuote += fee; remaining -= take;
    if (b.yQuote <= rtol) { j++; crossed++; }
  }

  const newActiveId = outOfRange ? right + 1 : j;
  return { newActiveId, baseOut, quoteIn, feeTotalQuote, crossed: Math.max(0, crossed - 1), outOfRange };
}

export function sellBaseForQuote(params: {
  cfg: DlmmConfig;
  P0: number;
  bins: Bin[];
  activeId: number;
  desiredBaseIn: number;       // user sells Δbase
  feeProvider?: FeeProvider;
  feeMin?: number;
  feeMax?: number;
  tol?: number;
}): { newActiveId: number; baseIn: number; quoteOut: number; feeTotalBase: number; crossed: number; outOfRange: boolean } {
  const { cfg, P0, bins, desiredBaseIn } = params;
  const left = cfg.grid.rangeBins.left;
  const right = cfg.grid.rangeBins.right;
  const idx = (j: number) => j - left;
  let j = params.activeId;
  let remaining = Math.max(0, desiredBaseIn);
  const rtol = params.tol ?? 1e-12;
  const feeMin = params.feeMin ?? 0;
  const feeMax = params.feeMax ?? cfg.fees.maxFeeRate;
  const feeProvider = params.feeProvider ?? (() => clamp(cfg.fees.baseFactor_B * (cfg.grid.binStep_bps / BASIS_POINT_MAX) * 10, feeMin, feeMax));

  let baseIn = 0; let quoteOut = 0; let feeTotalBase = 0; let crossed = 0; let outOfRange = false;

  while (remaining > rtol) {
    if (j > right) j = right;
    if (j < left) { outOfRange = true; break; }
    // Skip empties on sellable side (xBase)
    while (j >= left && bins[idx(j)] && bins[idx(j)].xBase <= rtol) { j--; crossed++; }
    if (j < left) { outOfRange = true; break; }
    const b = bins[idx(j)]; if (!b) { outOfRange = true; break; }
    const Pj = indexToPrice(cfg, j, P0);
    const xMax = b.xBase;
    if (xMax <= rtol) { j--; crossed++; continue; }
    const take = Math.min(remaining, xMax);
    const fr = clamp(feeProvider({ j, direction: 'SELL', bin: b }), feeMin, feeMax);
    const feeBase = take * fr; // fee in base
    b.xBase -= take;
    b.feeAccruedBase += feeBase;
    baseIn += take + feeBase; // user pays base incl fee
    const dQuote = take * Pj;
    quoteOut += dQuote; feeTotalBase += feeBase; remaining -= take;
    if (b.xBase <= rtol) { j--; crossed++; }
  }

  const newActiveId = outOfRange ? left - 1 : j;
  return { newActiveId, baseIn, quoteOut, feeTotalBase, crossed: Math.max(0, crossed - 1), outOfRange };
}

// Price impact formulas (min_price):
// Selling X for Y: min = spot * (BASIS_POINT_MAX - max_price_impact_bps) / BASIS_POINT_MAX
// Selling Y for X: min = spot * BASIS_POINT_MAX / (BASIS_POINT_MAX - max_price_impact_bps)
export function minPriceSellX(spotPrice: number, maxImpactBps: number) {
  const num = BASIS_POINT_MAX - Math.max(0, maxImpactBps);
  return spotPrice * (num / BASIS_POINT_MAX);
}
export function minPriceSellY(spotPrice: number, maxImpactBps: number) {
  const den = BASIS_POINT_MAX - Math.max(0, maxImpactBps);
  return spotPrice * (BASIS_POINT_MAX / den);
}

// Fees
export function baseFeeRate(cfg: DlmmConfig): number {
  const power = Math.max(0, Math.round(cfg.fees.baseFeePower ?? 0));
  // Meteora base fee scales with bin step and base factor
  // Convert bin step from bps to decimal; apply optional exponent
  const stepDec = cfg.grid.binStep_bps / BASIS_POINT_MAX;
  const rate = cfg.fees.baseFactor_B * stepDec * 10 * Math.pow(10, power);
  return Math.max(0, rate);
}

// Volatility accumulator parameters (per doc imagery)
export const OFFSET = 99_999_999_999; // OFFSET
export const SCALE = 100_000_000_000; // SCALE

export function updateVolatilityAccumulator(prev: number, binsCrossed: number, now: number, lastTime: number | null, cfg: DlmmConfig): number {
  // Simple time filter and decay model per doc text; can be tuned with advancedDefaults
  const tf = Math.max(0.001, cfg.advancedDefaults.volFilter_t_f_sec);
  const td = Math.max(tf, cfg.advancedDefaults.volDecay_t_d_sec);
  const R = Math.min(1, Math.max(0, cfg.advancedDefaults.decayFactor_R));
  if (lastTime === null) return Math.min(SCALE, Math.max(0, prev) + Math.min(SCALE, Math.abs(binsCrossed) * OFFSET));
  const dt = now - lastTime;
  let acc = prev;
  if (dt > td) acc = 0; // reset after inactivity
  else if (dt > tf) acc = acc * R; // decay
  acc += Math.min(SCALE, Math.abs(binsCrossed) * OFFSET);
  return Math.min(SCALE, Math.max(0, acc));
}

export function variableFeeRate(volatilityAccumulator: number, cfg: DlmmConfig): number {
  // variable_fee_rate = ((volatility_accumulator × bin_step)^2 × variable_fee_control + OFFSET) / SCALE
  const stepDec = cfg.grid.binStep_bps / BASIS_POINT_MAX;
  const term = volatilityAccumulator * stepDec;
  const rate = ((term * term) * cfg.fees.variableControl_A + OFFSET) / SCALE;
  return Math.max(0, rate);
}

export function totalFeeRate(baseRate: number, variableRate: number, cfg: DlmmConfig): number {
  return Math.min(cfg.fees.maxFeeRate, baseRate + variableRate);
}

// Constant-sum bin math: P · Δy/Δx = const per pool, but we keep a simple invariant L = price·x + y
export function constantSumL(price: number, x: number, y: number) {
  return price * x + y;
}

// Composition fee: swap_amount × total_fee_rate × (1 + total_fee_rate) / FEE_PRECISION^2
// We operate in decimal space, so FEE_PRECISION=1
export function compositionFee(swapAmount: number, totalFeeRateDecimal: number): number {
  const f = Math.max(0, totalFeeRateDecimal);
  return swapAmount * f * (1 + f);
}

export function nextIdWithDepletion(currentId: number, delta: number, left: number, right: number, forceDepletion: boolean): { id: number; frozen: boolean } {
  const nextId = currentId + delta;
  const inRange = (id: number) => id >= left && id <= right;
  if (!forceDepletion) return { id: nextId, frozen: false };
  if (inRange(currentId) && inRange(nextId)) return { id: nextId, frozen: false };
  if (!inRange(currentId) && inRange(nextId)) return { id: nextId, frozen: false };
  return { id: currentId, frozen: true };
}
