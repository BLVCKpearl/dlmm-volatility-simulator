"use client";
import React from "react";
import { DlmmConfig } from "./schema";
import { priceFromActiveId, updateVolatilityAccumulator } from "./engine";

export type TickPoint = { t: number; price: number };

export function useSimulator(defaults: DlmmConfig) {
  const [cfg, setCfg] = React.useState<DlmmConfig>(defaults);
  const [series, setSeries] = React.useState<TickPoint[]>([]);
  const [running, setRunning] = React.useState(false);
  const [active, setActive] = React.useState<{ activeId: number; x: number; y: number; price: number } | null>(null);
  const [fees, setFees] = React.useState<{ quote: number; base: number }>({ quote: 0, base: 0 });
  const [error, setError] = React.useState<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };

  const start = (opts?: { append?: boolean; timeOffset?: number }) => {
    try {
      clear(); setRunning(true);
      const append = !!opts?.append;
      const duration = Math.max(1, cfg.runtime.duration_sec);
      const lambda = Math.max(0.001, cfg.runtime.tradeArrival_lambda_per_sec);
      let t = append ? (series.at(-1)?.t ?? 0) : 0;
      let activeId = append ? (active?.activeId ?? 0) : cfg.grid.activeId;
      const basePrice = (cfg.startingPrices.xUsd / cfg.startingPrices.yUsd) || 1;
      let price = priceFromActiveId(cfg, activeId, basePrice);
      const out = append ? [...series] : [];

      const rand = () => Math.random();
      const nextInterArrival = () => { const u = Math.max(1e-9, rand()); return -Math.log(u) / lambda; };

      let vol = 0; let lastEvent: number | null = null;
      let frozen: null | 'above' | 'below' = null; // when out of range with depletion
      timer.current = setInterval(() => {
        for (let k = 0; k < 10 && t < duration; k++) {
          t += nextInterArrival();
          const buy = rand() < cfg.runtime.buyProbability;
          const stepCount = Math.max(1, Math.round(Math.exp(cfg.runtime.tradeSize_lognorm.mu_log + (cfg.runtime.tradeSize_lognorm.sigma_log * (rand()*2-1)))));
          const delta = buy ? stepCount : -stepCount;
          const nextId = activeId + delta;
          const left = cfg.grid.rangeBins.left; const right = cfg.grid.rangeBins.right;
          const currentlyInRange = activeId >= left && activeId <= right;
          const nextInRange = nextId >= left && nextId <= right;

          if (cfg.runtime.forceBinDepletion) {
            if (frozen) {
              if (nextInRange) {
                vol = updateVolatilityAccumulator(vol, Math.abs(delta), t, lastEvent, cfg);
                lastEvent = t;
                activeId = nextId;
                price = priceFromActiveId(cfg, activeId, basePrice);
                frozen = null;
              }
            } else {
              if (currentlyInRange && nextInRange) {
                vol = updateVolatilityAccumulator(vol, Math.abs(delta), t, lastEvent, cfg);
                lastEvent = t;
                activeId = nextId; price = priceFromActiveId(cfg, activeId, basePrice);
              } else if (currentlyInRange && !nextInRange) {
                vol = updateVolatilityAccumulator(vol, Math.abs(delta), t, lastEvent, cfg);
                lastEvent = t;
                frozen = nextId > right ? 'above' : 'below';
              } else {
                frozen = frozen ?? (activeId < left ? 'below' : 'above');
              }
            }
          } else {
            vol = updateVolatilityAccumulator(vol, Math.abs(delta), t, lastEvent, cfg);
            lastEvent = t;
            activeId = nextId; price = priceFromActiveId(cfg, activeId, basePrice);
          }

          out.push({ t, price });
        }
        setSeries([...out]);
        const displayId = frozen ? (frozen === 'above' ? cfg.grid.rangeBins.right + 1 : cfg.grid.rangeBins.left - 1) : activeId;
        setActive({ activeId: displayId, x: 0, y: 0, price });
        setFees({ quote: 0, base: 0 });
        if (t >= duration) { clear(); setRunning(false); }
      }, 50);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg); setRunning(false); clear();
    }
  };

  const stop = () => { clear(); setRunning(false); };

  React.useEffect(()=>()=>clear(),[]);
  return { cfg, setCfg, series, start, stop, running, error, active, fees } as const;
}
