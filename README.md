DLMM Volatility Simulator
=========================

Live app: `https://dlmm-volatility-simulator.vercel.app/`

Overview
--------
Interactive simulator for Discrete Liquidity Market Maker (DLMM) pricing dynamics with adjustable grid/bin settings, order flow, and presets.

Quick start
-----------
```bash
npm ci
npm run dev
# open http://localhost:3000
```

Key defaults
------------
- Duration: 60 minutes
- Trades/min: 100 (Poisson λ = 100/60 per sec)
- Buy probability: 0.50

Scripts
-------
- `npm run dev`: start Next.js dev server
- `npm run build`: build for production
- `npm run start`: run production server
- `npm run test`: run unit tests (Vitest)

Deploy
------
Auto-deployed from `main` to Vercel. Push to GitHub to trigger a deploy. Project URL: `https://github.com/BLVCKpearl/dlmm-volatility-simulator`.

Parameters reference
--------------------

Market setup
- Base/Quote symbols: Labels shown across the app (default `SOL`/`USD`).
- Prices (USD): Sets the initial absolute price P₀ = USD(X)/USD(Y).

Grid
- Bin step (bps): Price increment between adjacent bins. Smaller = finer steps.
  - Recommended: Stables 1–5 bps; Majors 10–50 bps; Volatile 50–200 bps.
- Active range (bins): Number of bins left/right of center that hold liquidity.

Liquidity
- Curve σ (bins): Standard deviation of Gaussian liquidity spread across bins.
  - Lower concentrates liquidity near center; higher spreads it out.
  - Recommended: Stables 4–10; Majors 12–20; Volatile 25–50.
- Total X / Total Y: Inventory amounts. Larger totals make price harder to move.

Fees
- B (baseFactor_B): Scales base fee with bin step (bps).
  - Recommended: 0.5–2.0
- baseFeePower: Integer amplifier for base fee.
  - Recommended: 0–2
- A (variableControl_A): Scales variable/volatility-based fee component.
  - Recommended: 0.5–3.0
- Max fee rate: Upper cap for total fee rate (decimal).
  - Typical caps: 0.01–0.05 (1–5%)
- Protocol %: Share of variable fee to protocol.
  - Typical: 0–0.5
- Fee-on-fee: If true, fees apply on top of previous fee component.

Runtime (order flow)
- Duration (min): Total simulated time.
  - Typical: 10–240 for exploration; default: 60
- Trades/min (λ): Average trade arrival rate (Poisson). Higher = denser events.
  - Typical: 30–600; default: 100 (λ = 100/60 per sec)
- Trade size μ (log): Mean of log-normal trade sizes (in X units).
  - Typical: −1.5 to −0.5; default: −1.0
- Trade size σ (log): Std dev of log-normal trade sizes.
  - Typical: 0.6–1.2; default: 0.9
- Buy probability: Chance each arrival is a buy versus sell.
  - Range: 0–1; default: 0.50
- Force bin depletion: When on, out-of-range behavior freezes movement until re-entry.
- Stream mode: Animate arrivals in near-real-time; off runs in batches.

Advanced (engine defaults)
- Vol filter t_f (s): Minimum time between volatility memory updates.
  - Typical: 0.5–5
- Vol decay t_d (s): Window after which volatility decays if no trades.
  - Typical: 2–15
- Vol decay R (0–1): Multiplicative decay factor in the window.
  - Typical: 0.3–0.8

Presets
- Stables (tight): Small bps, narrow σ, higher λ, lower sizes.
- Majors (medium): Medium bps/σ, moderate λ.
- Volatile (wide): Larger bps/σ, higher size variance.
