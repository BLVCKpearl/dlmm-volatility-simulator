export type DlmmConfig = {
  pair: { xSymbol: string; ySymbol: string };
  startingPrices: { xUsd: number; yUsd: number };
  grid: { binStep_bps: number; rangeBins: { left: number; right: number }; activeId: number };
  liquidity: { shape: 'Curve' | 'Flat'; curveSigma_bins: number; inventory: { xTotal: number; yTotal: number } };
  fees: { baseFactor_B: number; baseFeePower?: number; variableControl_A: number; maxFeeRate: number; protocolFeePct?: number; feeOnFee?: boolean };
  runtime: { duration_sec: number; seed: number; tradeArrival_lambda_per_sec: number; tradeSize_lognorm: { mu_log: number; sigma_log: number }; buyProbability: number; forceBinDepletion: boolean; stream: boolean };
  advancedDefaults: { volFilter_t_f_sec: number; volDecay_t_d_sec: number; decayFactor_R: number };
};

export type SimPoint = { t: number; price: number };

export const BASIS_POINT_MAX = 10_000; // per Meteora doc
export const FEE_PRECISION = 1; // we keep fees in decimal (0..1) for the UI


