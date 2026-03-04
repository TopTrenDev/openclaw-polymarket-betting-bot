# 🦞📈 OpenClaw Polymarket Betting Bot

A **TypeScript** skeleton bot for **5-minute** prediction markets on [Polymarket](https://polymarket.com), combining on-chain style signals with optional LLM context—built for paper trading and backtesting.

[![Telegram](https://img.shields.io/badge/Telegram-@toptrendev_66-2CA5E0?style=for-the-badge&logo=telegram)](https://t.me/TopTrenDev_66)
[![Twitter](https://img.shields.io/badge/Twitter-@toptrendev-1DA1F2?style=for-the-badge&logo=x)](https://x.com/intent/follow?screen_name=toptrendev)

---

## ✨ What It Does

- **🎯 5m horizon** — Predicts whether the YES price will be higher in 5 minutes using a lightweight ensemble (momentum, volatility, whale flow, optional LLM).
- **🐋 Whale flow proxy** — Uses recent large trades and volume/price metadata as a proxy for “smart money” flow (no wallet-level fills yet).
- **📊 Market microstructure** — Short-term price momentum (30s, 2m) and 2m volatility feed into the model.
- **🤖 Optional LLM scorer** — You can plug in an OpenAI-compatible model to add a narrative/context bias to the score.
- **📝 Paper-trading engine** — Position sizing, edge threshold, and HOLD/BUY/SELL logic without real money until you’re ready.

---


## 🚀 Quick Start

```bash
cd openclaw-polymarket-betting-bot
npm i
cp .env.example .env
npm run dev
```

The bot will poll the configured market, compute features, run the predictor, and log actions (e.g. `HOLD`, `BUY YES`, `SELL YES`) with **p5m** and **confidence** in the console.

---

## 🖥️ Compare UI (before full trading)

See live predictions and compare them to what actually happened after 5 minutes:

```bash
npm run ui
# open http://localhost:8787
```

The UI lets you:

- **Fetch** the latest bot prediction snapshot (market, current YES price, predicted side, P(UP 5m), confidence).
- **Enter** the actual YES price after 5 minutes (or use the auto-compare delay).
- **Compare** predicted side vs actual outcome (YES/NO).
- **Track** running accuracy (correct predictions / total).

---

## 📁 Project layout

```
├── src/
│   ├── app/                 # Bot entry point
│   │   └── index.ts         # Poll loop (npm run dev)
│   ├── server/             # UI HTTP server
│   │   └── index.ts         # Serves ui/ + /api/prediction (npm run ui)
│   └── lib/                # Shared core (used by app + server)
│       ├── config.ts        # Env config
│       ├── types/           # Shared types
│       ├── connectors/      # Polymarket API
│       ├── engine/          # Features, predictor, paper trader
│       └── models/          # Optional LLM scorer
├── ui/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── .env, .env.example
└── package.json
```

| Part | Role |
|------|------|
| **app** | Bot entry: runs the prediction loop (connector → features → predictor → paper trader). |
| **server** | Serves `ui/` and `/api/prediction` for the compare UI. |
| **lib** | Shared code: config, types, connectors, engine (features, predictor, paper trader), models (LLM). |

---

## ⚙️ Configuration (.env)

- **Polymarket** — `POLYMARKET_REST_BASE`, `POLYMARKET_MARKET_SLUG` or `POLYMARKET_MARKET_ID` (optional; otherwise the bot picks an active BTC up/down market).
- **Loop** — `LOOP_SECONDS` (how often to run the prediction loop).
- **Paper trading** — `MAX_POSITION_USD`, `EDGE_THRESHOLD`.
- **LLM** — `OPENAI_API_KEY`, optional `OPENAI_BASE_URL`, `OPENAI_MODEL`.

See `.env.example` for all variables.

---

## 📌 Notes

- **Paper-trading by default** — No real orders are placed; the connector pulls real market snapshots for a realistic test.
- **Whale flow** is currently a proxy (volume/price-change metadata), not wallet-level fills.
- You can **pin a market** with `POLYMARKET_MARKET_SLUG` or `POLYMARKET_MARKET_ID`.
- **No strategy guarantees profits** — Use for learning and experimentation.

---

## ⭐ Like this project?

If the project is interesting for you, **give it a star** on GitHub. If you want to know the project in more detail or have questions, please **contact me** — I’d be happy to chat.
