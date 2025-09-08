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

Think of the simulator like a game with knobs. Each knob changes how the price moves and how often it moves.

Market setup (what are we pricing?)
- Base/Quote symbols: Just the names you see (like SOL priced in USD). Changing the names doesn’t change math.
- Prices (USD): How many USD each token is worth at the start. This sets the starting price P₀. If SOL=200 and USD=1, then price starts near 200 USD/SOL.

Grid (how big each step is)
- Bin step (bps): Tiny stair step size between prices. Smaller steps = smoother, more detailed moves; bigger steps = chunkier, jumpy moves.
  - Try: Stables 1–5, Majors 10–50, Volatile 50–200 bps.
- Active range (bins): How wide the “playground” is (left to right) where liquidity actually sits. Wider range = price can travel farther before running out of liquidity.

Liquidity (how much “fuel” we have at each step)
- Curve σ (bins): How spread out the liquidity is. Small σ = a tall pile in the middle (harder to push price at first). Big σ = spread out (easier to nudge, smoother changes).
  - Try: Stables 4–10; Majors 12–20; Volatile 25–50.
- Total X / Total Y: How many tokens we provide. More tokens = heavier price, so it moves less per trade.

Fees (what traders pay per trade)
- B (baseFactor_B): Base fee strength tied to bin step. Higher B = more fee per trade.
  - Suggest: 0.5–2.0
- baseFeePower: Bonus multiplier (integer). Higher makes base fee grow faster.
  - Suggest: 0–2
- A (variableControl_A): Extra fee when price jumps around a lot. Higher A = more sensitivity to volatility.
  - Suggest: 0.5–3.0
- Max fee rate: Hard ceiling so fees can’t get too big. Decimal (0.02 = 2%).
  - Suggest: 1–5% caps
- Protocol %: What slice of variable fee the protocol keeps.
  - Common: 0–50%
- Fee-on-fee: If on, fees can stack on top of each other a bit (slightly higher total).

Runtime (how trades happen)
- Duration (min): How long the run lasts. Longer = more events and a longer chart.
  - Try: 10–240 while exploring; default 60.
- Trades/min (λ): How often trades appear on average. Bigger number = busier market and smoother-looking price line.
  - Try: 30–600; default 100 (≈1.67 per second)
- Trade size μ (log): Typical trade size (in log terms). Higher μ = bigger trades that can jump more bins.
  - Try: −1.5 to −0.5; default −1.0
- Trade size σ (log): How random trade sizes are. Higher σ = more surprise big trades.
  - Try: 0.6–1.2; default 0.9
- Buy probability: Chance a trade is a buy (vs sell). 0.5 is balanced; >0.5 pushes price up on average.
  - Range 0–1; default 0.50
- Force bin depletion: If on and price leaves the range, it “freezes” until it comes back (shows out-of-range behavior clearly).
- Stream mode: If on, you watch trades ticking in; if off, it computes faster in chunks.

Advanced (how the “volatility memory” works)
- Vol filter t_f (s): Minimum spacing between reading volatility. Smaller = more reactive, bigger = more chill.
  - Try: 0.5–5
- Vol decay t_d (s): If nothing happens for this long, the recent volatility starts fading.
  - Try: 2–15
- Vol decay R (0–1): How fast volatility fades. Smaller R = fades faster.
  - Try: 0.3–0.8

What happens if I move a knob?
- Make bin step smaller → more, finer price steps; looks smoother but may need more bins.
- Increase λ (trades/min) → more dots on the chart; price looks continuous.
- Increase μ or σ → trades get larger or more unpredictable; price jumps more.
- Raise B or A → traders pay more fees; LPs earn more, but too high might reduce trading.
- Increase inventories (Total X/Y) → price is heavier; needs bigger trades to move.

Presets (quick starts)
- Stables (tight): Small bin step, small σ, higher λ, smaller trades.
- Majors (medium): Middle-of-the-road settings.
- Volatile (wide): Bigger steps, wider σ, more randomness.
