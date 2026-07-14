# 🏛️ DonKAI Prediction Exchange: Production-Grade Clearinghouse

Welcome to the official repository for the **DonKAI Prediction Exchange** (anchored to the **Unykorn / GMIIE** institutional middleware stack). This repository contains the complete price-time priority matching engines, Black-Scholes risk management deltas, weighted multi-oracle dispute layers, EOD rebalancing tools, and tamper-evident cryptographic state ledgers.

---

## 📋 Table of Contents

- [🏛️ System Architecture Topology](#-system-architecture-topology)
- [📦 Repository Component Map](#-repository-component-map)
- [📡 Core API & WebSocket Services](#-core-api--websocket-services)
- [🧮 Quantitative Options Pricing Engine](#-quantitative-options-pricing-engine)
- [🛡️ Production Hardening Protocols](#-production-hardening-protocols)
- [🧪 Verification & Simulation Guides](#-verification--simulation-guides)
- [💼 Enterprise B2B white-Label Pillars](#-enterprise-b2b-white-label-pillars)

---

## 🏛️ System Architecture Topology

The DonKAI pipeline separates high-velocity retail frontend wagers from regulated Qualified Custody assets:

```
┌──────────────────────────────────────┐          ┌──────────────────────────────────────┐
│  DonKAI Frontend Portal (Port 9091)   │          │  Unykorn parent Cockpit (Port 9090)  │
│  - Retail macro trading interface    │          │  - Multi-agent prompt sandbox        │
│  - Live L2 order book updates        │          │  - Institutional custody manager     │
└──────────────────┬───────────────────┘          └──────────────────┬───────────────────┘
                   │                                                 │
                   │ (WebSocket / REST)                              │ (REST)
                   ▼                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        Unykorn Middleware Broker Engine (Port 3388)                    │
│                        - Black-Scholes Dynamic Volatility & Delta calculations         │
│                        - Localized Netting & Omnibus Aggregator (Scenario B)           │
│                        - Append-Only Cryptographic State Ledger (default.json)         │
└──────────────────┬─────────────────────────────────────────────────┬───────────────────┘
                   │                                                 │
                   │ (WebSocket Port 3399)                           │ (REST Port 3377)
                   ▼                                                 ▼
┌─────────────────────────────────────────────────┐ ┌────────────────────────────────────┐
│      WS CLOB Price-Time Matching Engine         │ │       BitGo Express Local Proxy    │
│      - Instant limit order crossing             │ │       - Main Treasury Router       │
│      - L2 book depth broadcast feeds            │ │       - Child sub-wallet generator │
└─────────────────────────────────────────────────┘ └────────────────────────────────────┘
```

---

## 📦 Repository Component Map

Below is the structured, color-coded inventory of all files powering the clearinghouse stack:

| File Name | Layer | Status | Description |
| :--- | :--- | :--- | :--- |
| 🖥️ `index.html` | **Frontend** | 🟢 Live | Dark HSL glassmorphic user dashboard containing L2 order book displays and betting tickets. |
| ⚙️ `app.js` | **Frontend** | 🟢 Live | Main frontend controller. Coordinates REST and WebSocket connections to update progress bars. |
| 🎨 `style.css` | **Frontend** | 🟢 Live | Premium styling sheet defining the HSL design variables. |
| 🛡️ `server.js` | **Broker** | 🟢 Active | Primary REST gateway exposing wagers, portfolio state, and delta hedging metrics. |
| 🧮 `delta_hedging_engine.js` | **Risk** | 🟢 Active | Black-Scholes module calculating option price ($C$) and contract delta ($\Delta$). |
| 🏛️ `oracle_consensus.js` | **Resolution**| 🟢 Verified| Weighted consensus (Chainlink, Pyth, Fed Reserve, TLSNotary) and arbitration state machine. |
| ⚡ `clob_server.js` | **Order Matching**| 🟢 Active | Central Limit Order Book server operating on WebSocket port `3399`. |
| 🔄 `auto_hedge_executor.js` | **Hedging** | 🟢 Verified| Direct execution router simulating swap fills on Jupiter and Coinbase Prime. |
| ⏰ `cron_rebalance_scheduler.js`| **Cash Flow** | 🟢 Scheduled| 16:00 EST mark-to-market Cron job sweeping margin stablecoins to secure vaults. |
| 🔒 `cryptographic_ledger.js` | **Security** | 🟢 Verified| SHA-256 hash chaining system validating `default.json` database integrity. |
| 🔑 `admin_seed_child.js` | **Custody** | 🟢 Verified| Programmatic SOL allocation script seeding rent-exemption to new child wallets. |
| 📁 `default.json` | **Database** | 🟢 Active | Private append-only cryptographically chained transaction database. |
| 📦 `package.json` | **Config** | 🟢 Confirmed| Defines Node.js dependencies (`ws`, `node-cron`, `@solana/web3.js`). |

---

## 📡 Core API & WebSocket Services

### WebSocket CLOB Gateway (`ws://localhost:3399`)
Listen for L2 updates and submit limit orders programmatically.

*   **L2 Broadcast Update**:
    ```json
    {
      "event": "book_update",
      "market_id": "fit21",
      "bids": [ [0.61, 20000], [0.60, 15000] ],
      "asks": [ [0.62, 5000], [0.63, 12000] ],
      "trades": []
    }
    ```

*   **Order Entry Input**:
    ```json
    {
      "action": "limit_order",
      "side": "BUY",
      "price": 0.61,
      "size": 10000,
      "marketId": "fit21"
    }
    ```

---

## 🧮 Quantitative Options Pricing Engine

Event contracts are priced as cash-or-nothing binary options using Black-Scholes assumptions:

$$C_{\text{binary}} = e^{-r\tau} N(d_2)$$

$$\Delta_{\text{binary}} = \frac{e^{-r\tau} n(d_2)}{S\sigma\sqrt{\tau}}$$

The risk desk reads the net contract delta output and dynamically hedges the outstanding pool on spot markets to keep Unykorn's balance sheet neutral.

---

## 🛡️ Production Hardening Protocols

1.  **Weighted Consensus Engine**: Queries independent feeds to resolve outcomes, preventing singular oracle failures.
2.  **Solana Rent-Exemption Pre-funding**: Automatically seeds **0.005 SOL** to newly generated child accounts to cover rent-exempt token storage.
3.  **Cryptographic ledger Chaining**: Links audit log blocks mathematically. Any unauthorized database injection instantly breaks the chain, blocking custody disbursals.

---

## 🧪 Verification & Simulation Guides

To run the full suite and confirm system health, execute:

```bash
# Run the mock multi-user WebSocket CLOB matching and cryptographic hash chain simulation
node simulate_multi_user_clob.js

# Run the consolidation test suite validating all risk, consensus, and cron parameters
node verify_production_stack.js
```
