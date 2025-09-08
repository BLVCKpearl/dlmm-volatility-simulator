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
