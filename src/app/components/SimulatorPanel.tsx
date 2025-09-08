"use client";
import React from "react";
import { useSimulator } from "@/lib/dlmm/useSimulator";
import { DlmmConfig } from "@/lib/dlmm/schema";
// (no helper imports in legacy mode)

// Charts
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Label as ChartLabel, ReferenceArea } from "recharts";
// Lightweight local UI primitives to match the mock
const Card = ({ className = "", children }: { className?: string; children: React.ReactNode }) => (
  <div className={`card-light ${className}`}>{children}</div>
);
const CardHeader = ({ className = "", children }: { className?: string; children: React.ReactNode }) => (
  <div className={`px-4 pt-4 ${className}`}>{children}</div>
);
const CardTitle = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`card-title text-sm ${className}`}>{children}</h2>
);
const CardContent = ({ className = "", children }: { className?: string; children: React.ReactNode }) => (
  <div className={`px-4 pb-4 ${className}`}>{children}</div>
);
const Separator = ({ className = "" }: { className?: string }) => (
  <div className={`h-px w-full bg-[var(--border)] my-2 ${className}`} />
);
const Button = (
  { children, className = "", ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string; children?: React.ReactNode }
) => (
  <button className={`rounded-lg border border-[var(--border)] bg-[#111827] hover:bg-[#0f172a] text-[var(--foreground)] px-3 py-2 text-sm ${className}`} {...props}>{children}</button>
);
const Input = (
  { className = "", ...props }:
  React.InputHTMLAttributes<HTMLInputElement> & { className?: string }
) => (
  <input className={`border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[#0b0d10] text-[var(--foreground)] ${className}`} {...props} />
);
const Label = ({ className = "", children }: { className?: string; children: React.ReactNode }) => (
  <label className={`text-sm text-gray-300 ${className}`}>{children}</label>
);
const Slider = ({ value, onChange, min=0, max=100, step=1 }: { value: number; onChange:(v:number)=>void; min?:number; max?:number; step?:number }) => (
  <input type="range" min={min} max={max} step={step} value={value} onChange={(e)=>onChange(Number(e.target.value))} className="w-full accent-[#3b82f6]" />
);
const Switch = ({ checked, onCheckedChange }: { checked:boolean; onCheckedChange:(v:boolean)=>void }) => (
  <input type="checkbox" checked={checked} onChange={(e)=>onCheckedChange(e.target.checked)} />
);
// Field helpers
const NumInput = ({ value, onChange, width = "w-40" }: { value: number; onChange: (v:number)=>void; width?: string }) => (
  <input className={`border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[#0b0d10] text-[var(--foreground)] ${width}`} value={String(value)} onChange={(e)=>onChange(Number(e.target.value))} />
);
const StackField = ({ label, info, width = "w-40", children }: { label: string; info?: React.ReactNode; width?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2">
      <Label className="text-sm text-gray-600">{label}</Label>
      {info}
    </div>
    <div className={width}>{children}</div>
  </div>
);
const Info = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-label={`Info: ${title}`}
        className="text-xs text-gray-300 hover:text-gray-100 w-5 h-5 leading-5 text-center border border-[var(--border)] rounded-full bg-[#111827]"
        onMouseEnter={()=>setOpen(true)}
        onMouseLeave={()=>setOpen(false)}
        onFocus={()=>setOpen(true)}
        onBlur={()=>setOpen(false)}
      >
        i
      </button>
      {open && (
        <div role="tooltip" className="absolute z-50 left-1/2 -translate-x-1/2 mt-2 w-72 max-w-[20rem] rounded-lg border border-[var(--border)] bg-[#0b0d10] p-3 text-xs text-gray-200 shadow-lg">
          {children || <div className="text-gray-600">{title}</div>}
        </div>
      )}
    </span>
  );
};

const DEFAULTS: DlmmConfig = {
  pair: { xSymbol: "SOL", ySymbol: "USD" },
  startingPrices: { xUsd: 205, yUsd: 1 },
  grid: { binStep_bps: 25, rangeBins: { left: -50, right: 50 }, activeId: 0 },
  liquidity: { shape: "Curve", curveSigma_bins: 16, inventory: { xTotal: 500, yTotal: 500 } },
  fees: { baseFactor_B: 1, baseFeePower: 0, variableControl_A: 1, maxFeeRate: 0.02, protocolFeePct: 0.05, feeOnFee: true },
  runtime: { duration_sec: 21600, seed: 42, tradeArrival_lambda_per_sec: 6, tradeSize_lognorm: { mu_log: -1.0, sigma_log: 0.9 }, buyProbability: 0.53, forceBinDepletion: true, stream: true },
  advancedDefaults: { volFilter_t_f_sec: 1, volDecay_t_d_sec: 5, decayFactor_R: 0.5 }
};

export default function SimulatorPanel({ pane = 'main' }: { pane?: 'main'|'suggested'|'rangebin' }) {
  const { cfg, setCfg, series, start, stop, running, active, fees } = useSimulator(DEFAULTS);
  const [paused, setPaused] = React.useState(false);
  const [chartStepSec] = React.useState<number>(1);
  const [activeRes, setActiveRes] = React.useState<{x:number;y:number;P:number}|null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  // Suggested Range Calculator state
  const [sgIn, setSgIn] = React.useState<{ P:number; volPct:number; horizon:number; unit:'days'|'weeks'; conf:0.68|0.95 }>({ P: 0, volPct: 5, horizon: 7, unit: 'days', conf: 0.95 });
  const [sgView, setSgView] = React.useState<'yPerX'|'xPerY'>("yPerX");
  const [sgOut, setSgOut] = React.useState<{ lower:number; upper:number; bins:number } | null>(null);
  // Range–Bin Step Calculator state
  const [rbIn, setRbIn] = React.useState<{ P:number; min:number; max:number; bps:number }>({ P: 0, min: 0, max: 0, bps: 25 });
  const [rbView, setRbView] = React.useState<'yPerX'|'xPerY'>("yPerX");

  React.useEffect(() => { if (active) setActiveRes({ x: active.x, y: active.y, P: active.price }); }, [active]);

  // Initialize Range–Bin calculator defaults from current price and grid step
  React.useEffect(() => {
    const P0 = (cfg.startingPrices.xUsd / cfg.startingPrices.yUsd) || 1;
    const lastAbs = series.at(-1)?.price ?? P0; // absolute price
    setRbIn(prev => {
      const P = prev.P && prev.P > 0 ? prev.P : lastAbs;
      const bps = prev.bps && prev.bps > 0 ? prev.bps : (cfg.grid.binStep_bps || 25);
      const hasRange = prev.min > 0 && prev.max > 0 && prev.max > prev.min;
      const min = hasRange ? prev.min : P * 0.9;
      const max = hasRange ? prev.max : P * 1.1;
      return { P, min, max, bps };
    });
  }, [series, cfg.grid.binStep_bps, cfg.startingPrices.xUsd, cfg.startingPrices.yUsd]);

  // Derived outputs for Range–Bin calculator
  const rbOut = React.useMemo(() => {
    const P = Math.max(0, rbIn.P);
    const min = Math.max(0, rbIn.min);
    const max = Math.max(0, rbIn.max);
    const bps = Math.max(0, rbIn.bps);
    if (!(P > 0) || !(min > 0) || !(max > 0) || !(max > min) || !(bps > 0)) return null;
    const stepDec = bps / 10_000;
    const stepFactor = 1 + stepDec;
    const denom = Math.log(stepFactor);
    if (!(denom > 0)) return null;
    const numBins = Math.floor(Math.log(max / min) / denom);
    const incDollar = P * stepDec;
    const incPct = stepDec * 100;
    const kStart = Math.ceil(Math.log(min / P) / denom);
    const kEnd = Math.floor(Math.log(max / P) / denom);
    const bins: Array<{low:number; high:number}> = [];
    const limit = 500;
    for (let k = kStart; k < kEnd && bins.length < limit; k++) {
      const low = P * Math.pow(stepFactor, k);
      const high = P * Math.pow(stepFactor, k + 1);
      bins.push({ low: Math.max(min, low), high: Math.min(max, high) });
    }
    return { binStepDecimal: stepDec, priceFactor: stepFactor, numBins: Math.max(0, numBins), incDollar, incPct, bins };
  }, [rbIn]);

  // (legacy mode: no effective seeded range computation)

  // Initialize Suggested Range "P" from current price
  React.useEffect(() => {
    const P0 = (cfg.startingPrices.xUsd / cfg.startingPrices.yUsd) || 1;
    const lastNorm = series.at(-1)?.price ?? P0;
    if (!sgIn.P || sgIn.P <= 0) setSgIn(s => ({ ...s, P: lastNorm }));
  }, [series, cfg.startingPrices.xUsd, cfg.startingPrices.yUsd, sgIn.P]);

  const outOfRange = React.useMemo<null | 'above' | 'below'>(() => {
    const a = active?.activeId; if (a === undefined || a === null) return null;
    const left = cfg.grid.rangeBins.left; const right = cfg.grid.rangeBins.right;
    if (a < left) return 'below'; if (a > right) return 'above'; return null;
  }, [active?.activeId, cfg.grid.rangeBins.left, cfg.grid.rangeBins.right]);

  const disabled = cfg.runtime.tradeArrival_lambda_per_sec <= 0;
  const apply = (fn: () => void) => { fn(); setTimeout(start, 0); };
  const setPresetStables = () => setCfg(prev => ({
    ...prev,
    grid: { ...prev.grid, binStep_bps: 5 },
    liquidity: { ...prev.liquidity, curveSigma_bins: 8, inventory: { xTotal: 200, yTotal: 200 } },
    fees: { ...prev.fees, baseFactor_B: 0.8, baseFeePower: 0, variableControl_A: 0.8, maxFeeRate: 0.01 },
    runtime: { ...prev.runtime, tradeArrival_lambda_per_sec: 8, duration_sec: 21600, buyProbability: 0.52, tradeSize_lognorm: { mu_log: -1.2, sigma_log: 0.8 } }
  }));
  const setPresetMajors = () => setCfg(prev => ({
    ...prev,
    grid: { ...prev.grid, binStep_bps: 25 },
    liquidity: { ...prev.liquidity, curveSigma_bins: 16, inventory: { xTotal: 500, yTotal: 500 } },
    fees: { ...prev.fees, baseFactor_B: 1.0, baseFeePower: 0, variableControl_A: 1.2, maxFeeRate: 0.02 },
    runtime: { ...prev.runtime, tradeArrival_lambda_per_sec: 6, duration_sec: 21600, buyProbability: 0.53, tradeSize_lognorm: { mu_log: -1.0, sigma_log: 0.9 } }
  }));
  const setPresetVolatile = () => setCfg(prev => ({
    ...prev,
    grid: { ...prev.grid, binStep_bps: 100 },
    liquidity: { ...prev.liquidity, curveSigma_bins: 28, inventory: { xTotal: 400, yTotal: 400 } },
    fees: { ...prev.fees, baseFactor_B: 1.2, baseFeePower: 0, variableControl_A: 2.0, maxFeeRate: 0.05 },
    runtime: { ...prev.runtime, tradeArrival_lambda_per_sec: 8, duration_sec: 21600, buyProbability: 0.55, tradeSize_lognorm: { mu_log: -0.7, sigma_log: 1.1 } }
  }));

  // Chart data build
  const chartData = React.useMemo(() => {
    const P0 = (cfg.startingPrices.xUsd / cfg.startingPrices.yUsd) || 1;
    const src = series.length ? series : [{ t: 0, price: (cfg.startingPrices.xUsd / cfg.startingPrices.yUsd) }];
    const duration = Math.max(1, cfg.runtime.duration_sec);
    const last = src[src.length - 1];
    const srcWithEnd = last && last.t < duration ? [...src, { t: duration, price: last.price }] : src;
    const MAX_POINTS = 3000;
    let dt = Math.max(0.1, chartStepSec);
    const nCandidate = Math.max(2, Math.floor(duration / dt) + 1);
    let n = nCandidate;
    if (nCandidate > MAX_POINTS) { n = MAX_POINTS; dt = duration / (n - 1); }
    const data: Array<{ t: number; price: number }> = [];
    let j = 0;
    for (let i = 0; i < n; i++) {
      const ti = i * dt;
      while (j < srcWithEnd.length - 1 && srcWithEnd[j + 1].t < ti) j++;
      const a = srcWithEnd[j]; const b = srcWithEnd[Math.min(j + 1, srcWithEnd.length - 1)];
      let pi = a.price; if (b.t !== a.t) { const w = (ti - a.t) / (b.t - a.t); pi = a.price + w * (b.price - a.price); }
      data.push({ t: ti / 60, price: pi / P0 });
    }
    return data;
  }, [series, cfg.startingPrices.xUsd, cfg.startingPrices.yUsd, cfg.runtime.duration_sec, chartStepSec]);

  // Active bin compact breakdown
  // (intentionally no extra breakdown UI; keep chart + LP fee header only)

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 md:space-y-6">
      {/* 1) Market Setup */}
      <a id="main-sim" className="block" />
      <Card className={pane === 'main' ? "" : 'hidden'}>
        <CardHeader className="pb-2">
          <CardTitle className="">Market Setup</CardTitle>
          <Separator />
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-gray-700">Base token (symbol)</Label>
                <Info title="Base token">The asset being priced, e.g. SOL or BTC.</Info>
              </div>
              <Input className="w-64" value={cfg.pair.xSymbol} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setCfg({ ...cfg, pair: { ...cfg.pair, xSymbol: e.target.value } })} placeholder="SOL" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-gray-700">Quote token (symbol)</Label>
                <Info title="Quote token">The unit you quote the price in, e.g. USD or ETH.</Info>
              </div>
              <Input className="w-64" value={cfg.pair.ySymbol} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setCfg({ ...cfg, pair: { ...cfg.pair, ySymbol: e.target.value } })} placeholder="USD" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-gray-700">{`${cfg.pair.xSymbol} price (USD)`}</Label>
                <Info title={`${cfg.pair.xSymbol} price (USD)`}>USD price of the Base token. Together with the Quote price sets P₀ = USD(X)/USD(Y).</Info>
              </div>
              <NumInput width="w-64" value={cfg.startingPrices.xUsd} onChange={(v)=>setCfg({ ...cfg, startingPrices: { ...cfg.startingPrices, xUsd: v } })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-gray-700">{`${cfg.pair.ySymbol} price (USD)`}</Label>
                <Info title={`${cfg.pair.ySymbol} price (USD)`}>USD price of the Quote token. P₀ = USD(X)/USD(Y).</Info>
              </div>
              <NumInput width="w-64" value={cfg.startingPrices.yUsd} onChange={(v)=>setCfg({ ...cfg, startingPrices: { ...cfg.startingPrices, yUsd: v } })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-gray-700">Bin step (bps)</Label>
                <Info title="Bin step (bps)">
                  <div>
                    The discrete price tick between adjacent bins. Smaller values create finer
                    price granularity (more frequent, smaller steps). Larger values produce
                    chunkier jumps. Recommendations:
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li>Stables: 1–5 bps</li>
                      <li>Majors: 10–50 bps</li>
                      <li>Volatile: 50–200 bps</li>
                    </ul>
                  </div>
                </Info>
              </div>
              <NumInput width="w-64" value={cfg.grid.binStep_bps} onChange={(v)=>setCfg({ ...cfg, grid: { ...cfg.grid, binStep_bps: v } })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-gray-700">Curve σ (bins)</Label>
                <Info title="Curve σ (bins)">
                  <div>
                    Standard deviation of the Gaussian Curve liquidity across bins. Smaller σ
                    concentrates liquidity near the center (harder to move price initially,
                    faster once outside). Larger σ spreads liquidity out (smoother moves).
                    Recommended ranges:
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li>Stables: 4–10</li>
                      <li>Majors: 12–20</li>
                      <li>Volatile: 25–50</li>
                    </ul>
                  </div>
                </Info>
              </div>
              <NumInput width="w-64" value={cfg.liquidity.curveSigma_bins} onChange={(v)=>setCfg({ ...cfg, liquidity: { ...cfg.liquidity, curveSigma_bins: v } })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-gray-700">Total X</Label>
                <Info title="Total X">Token inventories. Larger totals = smaller price jumps; smaller totals = easier bin moves.</Info>
              </div>
              <NumInput width="w-64" value={cfg.liquidity.inventory.xTotal} onChange={(v)=>setCfg({ ...cfg, liquidity: { ...cfg.liquidity, inventory: { ...cfg.liquidity.inventory, xTotal: v } } })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-gray-700">Total Y</Label>
                <Info title="Total Y">Token inventories. Larger totals = smaller price jumps; smaller totals = easier bin moves.</Info>
              </div>
              <NumInput width="w-64" value={cfg.liquidity.inventory.yTotal} onChange={(v)=>setCfg({ ...cfg, liquidity: { ...cfg.liquidity, inventory: { ...cfg.liquidity.inventory, yTotal: v } } })} />
            </div>
          </div>
          {/* Effective Range display removed in legacy mode */}
          {/* Advanced parameters toggle */}
          <div className="mt-4">
            <Button className="" onClick={()=>setShowAdvanced(s=>!s)}>
              {showAdvanced ? 'Hide advanced parameters' : 'Show advanced parameters'}
            </Button>
          </div>
          {showAdvanced && (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Fees</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <StackField label="B" info={<Info title="B (Base factor)"><div>Scales base fee with bin step. Typical 0.5–2.</div></Info>} width="w-44">
                    <NumInput value={cfg.fees.baseFactor_B} onChange={(v)=>setCfg({...cfg, fees:{...cfg.fees, baseFactor_B:Math.max(0,v)}})} />
                  </StackField>
                  <StackField label="baseFeePower" info={<Info title="Base fee power"><div>Integer amplifier in base fee. Use integers.</div></Info>} width="w-44">
                    <NumInput value={cfg.fees.baseFeePower ?? 0} onChange={(v)=>setCfg({...cfg, fees:{...cfg.fees, baseFeePower:Math.max(0, Math.round(v))}})} />
                  </StackField>
                  <StackField label="A" info={<Info title="A (Variable control)"><div>Controls variable (volatility) fee. Typical 0.5–3.</div></Info>} width="w-44">
                    <NumInput value={cfg.fees.variableControl_A} onChange={(v)=>setCfg({...cfg, fees:{...cfg.fees, variableControl_A:Math.max(0,v)}})} />
                  </StackField>
                  <StackField label="Max fee (cap)" info={<Info title="Max fee cap"><div>Upper cap for total fee rate (float).</div></Info>} width="w-44">
                    <NumInput value={cfg.fees.maxFeeRate} onChange={(v)=>setCfg({...cfg, fees:{...cfg.fees, maxFeeRate:Math.max(0, Math.min(0.2, v))}})} />
                  </StackField>
                  <StackField label="Protocol %" info={<Info title="Protocol share"><div>Share of variable fee going to protocol.</div></Info>} width="w-44">
                    <NumInput value={cfg.fees.protocolFeePct ?? 0} onChange={(v)=>setCfg({...cfg, fees:{...cfg.fees, protocolFeePct:Math.max(0, Math.min(0.5, v))}})} />
                  </StackField>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Engine defaults</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <StackField label="Vol filter t_f (s)" info={<Info title="Volatility filter horizon"><div>Minimum time gap before updating volatility memory.</div></Info>} width="w-48">
                    <NumInput value={cfg.advancedDefaults.volFilter_t_f_sec} onChange={(v)=>setCfg({...cfg, advancedDefaults:{...cfg.advancedDefaults, volFilter_t_f_sec: Math.max(0.1, v)}})} />
                  </StackField>
                  <StackField label="Vol decay t_d (s)" info={<Info title="Volatility decay window"><div>Time after which volatility resets if no trades.</div></Info>} width="w-48">
                    <NumInput value={cfg.advancedDefaults.volDecay_t_d_sec} onChange={(v)=>setCfg({...cfg, advancedDefaults:{...cfg.advancedDefaults, volDecay_t_d_sec: Math.max(0.5, v)}})} />
                  </StackField>
                  <StackField label="Vol decay R (0–1)" info={<Info title="Decay factor R"><div>Multiplicative decay factor during the window.</div></Info>} width="w-48">
                    <NumInput value={cfg.advancedDefaults.decayFactor_R} onChange={(v)=>setCfg({...cfg, advancedDefaults:{...cfg.advancedDefaults, decayFactor_R: Math.max(0, Math.min(1, v))}})} />
                  </StackField>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2 & 3 side-by-side */}
      <div className={pane === 'main' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'hidden'}>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="">Simulation timing and order flow</CardTitle>
          <Separator />
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-gray-700">Duration (min)</Label>
              <Info title="Duration (minutes)"><div>Total simulated wall-clock time. Longer runs produce more events and a longer chart. Recommend 10–240 min while exploring.</div></Info>
            </div>
            <div className="w-64 space-y-2">
              <Slider value={Math.round(cfg.runtime.duration_sec/60)} onChange={(v)=>setCfg({...cfg, runtime:{...cfg.runtime, duration_sec: Math.max(1, Math.min(1440, v)) * 60}})} min={1} max={1440} step={1} />
              <NumInput width="w-64" value={Math.round(cfg.runtime.duration_sec/60)} onChange={(v)=>setCfg({...cfg, runtime:{...cfg.runtime, duration_sec: Math.max(1, Math.min(1440, Math.round(v))) * 60}})} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-gray-700">trades/min</Label>
              <Info title="Arrival rate λ"><div>Average trade arrivals per minute (Poisson). Higher λ reduces gaps between trades and makes the price profile denser. Recommend 30–600 /m for continuous-looking profiles.</div></Info>
            </div>
            <div className="w-64 space-y-2">
              <Slider value={Math.round(cfg.runtime.tradeArrival_lambda_per_sec*60)} onChange={(v)=>setCfg({...cfg, runtime:{...cfg.runtime, tradeArrival_lambda_per_sec: Math.max(0, v/60)}})} min={0} max={1200} step={1} />
              <NumInput width="w-64" value={cfg.runtime.tradeArrival_lambda_per_sec*60} onChange={(v)=>setCfg({ ...cfg, runtime: { ...cfg.runtime, tradeArrival_lambda_per_sec: Math.max(0, v/60) } })} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-gray-700">Size μ (log)</Label>
                <Info title="Trade size μ (log)"><div>Mean of log-normal trade sizes in X units. Higher μ yields larger trades on average, which deplete bins quicker and create more steps. Try −1.5 to −0.5.</div></Info>
              </div>
              <div className="w-64 space-y-1">
                <Slider value={cfg.runtime.tradeSize_lognorm.mu_log} onChange={(v)=>setCfg({...cfg, runtime:{...cfg.runtime, tradeSize_lognorm:{...cfg.runtime.tradeSize_lognorm, mu_log: v}}})} min={-6} max={0} step={0.1} />
                <div className="text-xs text-gray-600 tabular-nums">{cfg.runtime.tradeSize_lognorm.mu_log.toFixed(2)}</div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-gray-700">Size σ (log)</Label>
                <Info title="Trade size σ (log)"><div>Standard deviation of log-normal trade sizes. Larger σ increases the chance of very large trades that jump multiple bins. Try 0.6–1.2.</div></Info>
              </div>
              <div className="w-64 space-y-1">
                <Slider value={cfg.runtime.tradeSize_lognorm.sigma_log} onChange={(v)=>setCfg({...cfg, runtime:{...cfg.runtime, tradeSize_lognorm:{...cfg.runtime.tradeSize_lognorm, sigma_log: v}}})} min={0.2} max={2.0} step={0.05} />
                <div className="text-xs text-gray-600 tabular-nums">{cfg.runtime.tradeSize_lognorm.sigma_log.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3) Strategy Presets & Toggles */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="">Strategy presets and toggles</CardTitle>
          <Separator />
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={()=>apply(setPresetStables)}>Stables (tight)</Button>
            <Button onClick={()=>apply(setPresetMajors)}>Majors (medium)</Button>
            <Button onClick={()=>apply(setPresetVolatile)}>Volatile (wide)</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-gray-700">force bin depletion</Label>
              <Switch checked={!!cfg.runtime.forceBinDepletion} onCheckedChange={(v)=>setCfg({...cfg, runtime:{...cfg.runtime, forceBinDepletion: v}})} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-gray-700">stream mode</Label>
              <Switch checked={!!cfg.runtime.stream} onCheckedChange={(v)=>setCfg({...cfg, runtime:{...cfg.runtime, stream: v}})} />
            </div>
            <div className="md:col-span-3"></div>
            <div className="flex items-center justify-between gap-3 md:col-span-2">
              <Label className="text-sm text-gray-700">Buy probability</Label>
              <Input type="number" min={0} max={1} step={0.01} className="w-64" value={cfg.runtime.buyProbability} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>{
                const val = parseFloat(e.target.value);
                setCfg({ ...cfg, runtime: { ...cfg.runtime, buyProbability: isNaN(val) ? 0 : Math.min(1, Math.max(0, val)) } });
              }} />
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* 4) Actions */}
      <Card className={pane === 'main' ? "" : 'hidden'}>
        <CardHeader className="pb-2">
          <CardTitle className="">Actions</CardTitle>
          <Separator />
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap justify-end gap-3">
            <Button className={`${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={disabled} onClick={() => { setPaused(false); start(); }}>
              {running ? "Running…" : "Run"}
            </Button>
            {running && (<Button className="border border-red-500 text-red-300" onClick={stop}>Stop</Button>)}
            {running && (<Button className="border border-amber-500 text-amber-300" onClick={() => { stop(); setPaused(true); }}>Pause</Button>)}
            {!running && paused && (<Button className="border border-emerald-500 text-emerald-300" onClick={() => { const tLast = series.at(-1)?.t ?? 0; start({ append: true, timeOffset: tLast }); setPaused(false); }}>Resume</Button>)}
            <Button
              onClick={() => {
                const P0 = (cfg.startingPrices.xUsd / cfg.startingPrices.yUsd) || 1;
                const rows = ["t,price,price_norm"]; for (const p of series) rows.push(`${p.t},${p.price},${p.price / P0}`);
                const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `${cfg.pair.xSymbol}_${cfg.pair.ySymbol}_series.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
              }}
            >Export CSV</Button>
          </div>
        </CardContent>
      </Card>

      {/* 5) Price Over Time (Chart) */}
      <Card className={pane === 'main' ? "" : 'hidden'}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="">Price Over Time</CardTitle>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-gray-400">LP Fees:</span>
              <span className="text-xs text-gray-200 tabular-nums">{fees.quote.toFixed(4)} {cfg.pair.ySymbol}</span>
              <span className="text-xs text-gray-400">/</span>
              <span className="text-xs text-gray-200 tabular-nums">{fees.base.toFixed(4)} {cfg.pair.xSymbol}</span>
              {outOfRange && (
                <span className="px-2 py-1 rounded-full text-xs font-semibold border border-red-300 text-red-700">Out of range — {outOfRange}</span>
              )}
            </div>
          </div>
          <Separator />
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-72 w-full rounded-xl border border-[var(--border)] bg-[#0b0d10] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.12} stroke="#2b313a" />
                <XAxis dataKey="t" tickFormatter={(v: number)=>Number(v).toFixed(0)} tick={{ fill: '#cbd5e1', fontSize: 12 }} stroke="#2b313a">
                  <ChartLabel value="Time (minutes)" position="insideBottom" offset={-4} />
                </XAxis>
                <YAxis domain={["auto","auto"]} tickFormatter={(v: number)=>Number(v).toFixed(3)} tick={{ fill: '#cbd5e1', fontSize: 12 }} stroke="#2b313a">
                  <ChartLabel value={`Token Price (${cfg.pair.ySymbol}/${cfg.pair.xSymbol})`} angle={-90} position="insideLeft" offset={10} />
                </YAxis>
                <Tooltip formatter={(v: number) => (Number(v).toFixed(6))} labelFormatter={(l: number) => `t=${Number(l).toFixed(2)}m`} contentStyle={{ background: '#000000e6', border: '1px solid #2b313a', color: '#f8fafc', borderRadius: 8, padding: 8 }} />
                <Line type="linear" dataKey="price" dot={false} isAnimationActive={false} strokeWidth={2} stroke="#2563eb" />
                {outOfRange && (
                  <ReferenceArea x1={0} x2={chartData.at(-1)?.t ?? 0} y1={outOfRange==='above'? (Math.max(...chartData.map(d=>d.price))*0.999) : 0} y2={outOfRange==='above'? 999999 : (Math.min(...chartData.map(d=>d.price))*1.001)} fill="#fee2e2" fillOpacity={0.3} strokeOpacity={0} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* LP fee totals and out-of-range badge remain in header */}
        </CardContent>
      </Card>

      {/* 6) Suggested Range Calculator */}
      <a id="suggested-range" className="block" />
      <Card className={pane === 'suggested' ? "" : 'hidden'}>
        <CardHeader className="pb-2">
          <CardTitle className="">Suggested Range Calculator</CardTitle>
          <Separator />
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <StackField label={sgView === 'yPerX' ? `Current price (${cfg.pair.ySymbol}/${cfg.pair.xSymbol})` : `Current price (${cfg.pair.xSymbol}/${cfg.pair.ySymbol})`} width="w-64">
              <div className="space-y-1">
                <NumInput width="w-64"
                  value={sgView === 'yPerX' ? sgIn.P : (sgIn.P > 0 ? 1/sgIn.P : 0)}
                  onChange={(v)=>setSgIn(s=>({ ...s, P: Math.max(0.000001, sgView === 'yPerX' ? v : (v > 0 ? 1/v : 0)) }))}
                />
                <div className="text-[11px] text-neutral-400">≈ {sgIn.P > 0 ? (sgView === 'yPerX' ? (1/sgIn.P).toFixed(6) : sgIn.P.toFixed(6)) : '-'} {sgView === 'yPerX' ? `${cfg.pair.xSymbol}/${cfg.pair.ySymbol}` : `${cfg.pair.ySymbol}/${cfg.pair.xSymbol}`}</div>
              </div>
            </StackField>
            <div className="flex flex-col items-start justify-end pb-[2px] mt-6 shrink-0">
              <button className="text-xs px-2 py-1 rounded border border-[var(--border)] bg-white hover:bg-gray-50" onClick={()=>setSgView(v=> v === 'yPerX' ? 'xPerY' : 'yPerX')}>Swap view</button>
            </div>
            <StackField label="Expected volatility (%)" width="w-64">
              <NumInput width="w-64" value={sgIn.volPct} onChange={(v)=>setSgIn(s=>({...s, volPct: Math.max(0, v)}))} />
            </StackField>
            <StackField label="Horizon" width="w-64">
              <div className="flex items-center gap-2">
                <NumInput width="w-28" value={sgIn.horizon} onChange={(v)=>setSgIn(s=>({...s, horizon: Math.max(1, Math.round(v))}))} />
                <select className="bg-neutral-800 rounded px-2 py-2 w-28" value={sgIn.unit} onChange={(e)=>setSgIn(s=>({...s, unit: e.target.value as 'days'|'weeks'}))}>
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                </select>
              </div>
            </StackField>
            <StackField label="Confidence" width="w-64">
              <select className="bg-neutral-800 rounded px-2 py-2 w-64" value={sgIn.conf} onChange={(e)=>setSgIn(s=>({...s, conf: (Number(e.target.value) as 0.68|0.95)}))}>
                <option value={0.68}>68% (tighter)</option>
                <option value={0.95}>95% (wider)</option>
              </select>
            </StackField>
            <button className="border border-[var(--border)] rounded px-3 py-2 bg-white hover:bg-gray-50" onClick={()=>{
              const mult = sgIn.conf === 0.95 ? 2 : 1; const v = (sgIn.volPct/100) * mult; const lower = Math.max(0, sgIn.P * (1 - v)); const upper = sgIn.P * (1 + v);
              const step = Math.log(1 + cfg.grid.binStep_bps/10000); const bins = step > 0 ? Math.ceil(Math.log(upper/lower) / step) : 0; setSgOut({ lower, upper, bins });
            }}>Suggest range</button>
          </div>
          {sgOut && (()=>{ const lowerInv = sgOut.upper > 0 ? 1/sgOut.upper : 0; const upperInv = sgOut.lower > 0 ? 1/sgOut.lower : 0; return (
            <div className="text-sm text-gray-800 space-y-1">
              <div>Suggested min/max: <span className="tabular">{sgOut.lower.toFixed(6)}</span> – <span className="tabular">{sgOut.upper.toFixed(6)}</span> {cfg.pair.ySymbol}/{cfg.pair.xSymbol} (<span className="tabular">{sgOut.bins}</span> bins @ {cfg.grid.binStep_bps} bps)</div>
              <div className="text-gray-500">Reciprocal: <span className="tabular">{lowerInv.toFixed(6)}</span> – <span className="tabular">{upperInv.toFixed(6)}</span> {cfg.pair.xSymbol}/{cfg.pair.ySymbol}</div>
              <div>Your liquidity will stay active between {cfg.pair.ySymbol} {sgOut.lower.toFixed(2)} and {sgOut.upper.toFixed(2)}, covering ~{Math.round(sgIn.conf*100)}% of expected moves over {sgIn.horizon} {sgIn.unit}.</div>
            </div>
          ); })()}
        </CardContent>
      </Card>

      {/* 7) Range–Bin Step Calculator */}
      <a id="range-bin" className="block" />
      <Card className={pane === 'rangebin' ? "" : 'hidden'}>
        <CardHeader className="pb-2">
          <CardTitle className="">Range–Bin Step Calculator</CardTitle>
          <Separator />
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <StackField label={rbView === 'yPerX' ? `Current price (${cfg.pair.ySymbol}/${cfg.pair.xSymbol})` : `Current price (${cfg.pair.xSymbol}/${cfg.pair.ySymbol})`} width="w-64">
              <div className="space-y-1">
                <NumInput width="w-64" value={rbView === 'yPerX' ? rbIn.P : (rbIn.P > 0 ? 1/rbIn.P : 0)} onChange={(v)=>setRbIn(s=>({ ...s, P: Math.max(0.000001, rbView === 'yPerX' ? v : (v > 0 ? 1/v : 0)) }))} />
                <div className="text-[11px] text-neutral-400">≈ {rbIn.P > 0 ? (rbView === 'yPerX' ? (1/rbIn.P).toFixed(6) : rbIn.P.toFixed(6)) : '-'} {rbView === 'yPerX' ? `${cfg.pair.xSymbol}/${cfg.pair.ySymbol}` : `${cfg.pair.ySymbol}/${cfg.pair.xSymbol}`}</div>
              </div>
            </StackField>
            <div className="flex flex-col items-start justify-end pb-[2px] mt-6 shrink-0">
              <button className="text-xs px-2 py-1 rounded border border-[var(--border)] bg-white hover:bg-gray-50" onClick={()=>setRbView(v=> v === 'yPerX' ? 'xPerY' : 'yPerX')}>Swap view</button>
            </div>
            <StackField label="Min price" width="w-64">
              <div className="space-y-1">
                <NumInput width="w-64" value={rbView === 'yPerX' ? rbIn.min : (rbIn.min > 0 ? 1/rbIn.min : 0)} onChange={(v)=>setRbIn(s=>({ ...s, min: Math.max(0.000001, rbView === 'yPerX' ? v : (v > 0 ? 1/v : 0)) }))} />
                <div className="text-[11px] text-neutral-400">≈ {rbIn.min > 0 ? (rbView === 'yPerX' ? (1/rbIn.min).toFixed(6) : rbIn.min.toFixed(6)) : '-'} {rbView === 'yPerX' ? `${cfg.pair.xSymbol}/${cfg.pair.ySymbol}` : `${cfg.pair.ySymbol}/${cfg.pair.xSymbol}`}</div>
              </div>
            </StackField>
            <StackField label="Max price" width="w-64">
              <div className="space-y-1">
                <NumInput width="w-64" value={rbView === 'yPerX' ? rbIn.max : (rbIn.max > 0 ? 1/rbIn.max : 0)} onChange={(v)=>setRbIn(s=>({ ...s, max: Math.max(0.000001, rbView === 'yPerX' ? v : (v > 0 ? 1/v : 0)) }))} />
                <div className="text-[11px] text-neutral-400">≈ {rbIn.max > 0 ? (rbView === 'yPerX' ? (1/rbIn.max).toFixed(6) : rbIn.max.toFixed(6)) : '-'} {rbView === 'yPerX' ? `${cfg.pair.xSymbol}/${cfg.pair.ySymbol}` : `${cfg.pair.ySymbol}/${cfg.pair.xSymbol}`}</div>
              </div>
            </StackField>
            <StackField label="Bin step (bps)" width="w-64">
              <NumInput width="w-64" value={rbIn.bps} onChange={(v)=>setRbIn(s=>({...s, bps: Math.max(0.000001, v)}))} />
            </StackField>
            <div className="flex items-center gap-2 ml-2">
              <button className="text-xs px-2 py-1 rounded border border-[var(--border)] bg-white hover:bg-gray-50" onClick={()=>{ setRbIn(s=>({ ...s, min: s.P * 0.95, max: s.P * 1.05 })); }}>Narrow (±5%)</button>
              <button className="text-xs px-2 py-1 rounded border border-[var(--border)] bg-white hover:bg-gray-50" onClick={()=>{ setRbIn(s=>({ ...s, min: s.P * 0.90, max: s.P * 1.10 })); }}>Medium (±10%)</button>
              <button className="text-xs px-2 py-1 rounded border border-[var(--border)] bg-white hover:bg-gray-50" onClick={()=>{ setRbIn(s=>({ ...s, min: s.P * 0.80, max: s.P * 1.20 })); }}>Wide (±20%)</button>
            </div>
          </div>
          {rbOut && (()=>{ const lowerInv = rbIn.max > 0 ? 1/rbIn.max : 0; const upperInv = rbIn.min > 0 ? 1/rbIn.min : 0; return (
            <div className="text-sm text-gray-800 space-y-1">
              <div>Number of bins: <span className="tabular">{rbOut.numBins}</span> to cover [{rbIn.min.toFixed(6)}, {rbIn.max.toFixed(6)}]</div>
              <div className="text-gray-500">Reciprocal range: [{lowerInv.toFixed(6)}, {upperInv.toFixed(6)}] {cfg.pair.xSymbol}/{cfg.pair.ySymbol}</div>
              <div>Price increment per bin: <span className="tabular">${rbOut.incDollar.toFixed(6)}</span> (~{rbOut.incPct.toFixed(3)}%)</div>
              <div>Dollar distance per bin: <span className="tabular">${rbOut.incDollar.toFixed(6)}</span></div>
              <div>Bin factor: ×{rbOut.priceFactor.toFixed(6)} per step</div>
            </div>
          ); })()}
        </CardContent>
      </Card>

      {/* 7) Planning */}
      <Card className={pane === 'main' ? "" : 'hidden'}>
        <CardContent className="flex justify-end">
          <Button onClick={()=>{
            const P0 = (cfg.startingPrices.xUsd / cfg.startingPrices.yUsd) || 1;
            const plan = {
              pair: cfg.pair,
              totalLiquidity: { X: cfg.liquidity.inventory.xTotal, Y: cfg.liquidity.inventory.yTotal },
              activeBin: { X: activeRes?.x ?? null, Y: activeRes?.y ?? null },
              tradeSizes: {
                pct1: Math.max(cfg.liquidity.inventory.xTotal*0.01, cfg.liquidity.inventory.yTotal*0.01/P0),
                pct5: Math.max(cfg.liquidity.inventory.xTotal*0.05, cfg.liquidity.inventory.yTotal*0.05/P0),
                pct10: Math.max(cfg.liquidity.inventory.xTotal*0.10, cfg.liquidity.inventory.yTotal*0.10/P0),
              }
            };
            const blob = new Blob([JSON.stringify(plan, null, 2)], {type:'application/json'});
            const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'liquidity_plan.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
          }}>Export Liquidity Plan</Button>
        </CardContent>
      </Card>
    </div>
  );
}
