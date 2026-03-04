# 🦞📈 OpenClaw Polymarket Betting Bot

A **TypeScript** skeleton bot for **5-minute** prediction markets on [Polymarket](https://polymarket.com), combining on-chain style signals with optional LLM context—built for paper trading and backtesting before going live.

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

## 📁 Project Layout (high level)

| Part | Role |
|------|------|
| **Connector** | Fetches market ticks and whale-flow proxy from Polymarket Gamma API. |
| **Features** | Builds a feature vector (returns, volatility, whale bias/intensity). |
| **Predictor** | Heuristic ensemble → **P(UP 5m)** and confidence. |
| **Paper trader** | Converts predictions into HOLD/BUY/SELL with configurable edge and size. |
| **LLM scorer** | Optional; adds a scalar bias from an OpenAI-compatible API. |
| **UI server** | Serves the compare UI and `/api/prediction` for the frontend. |

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

## 📜 License

Use and modify as you like; always verify behavior and risk before trading real funds.
