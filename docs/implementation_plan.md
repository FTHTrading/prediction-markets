# DonKAI Prediction Exchange: Phase 3 Production Implementation Plan

This document outlines the design and implementation plan to address the **5 Core Production Gaps** in the Unykorn/DonKAI prediction exchange platform, transitioning the high-fidelity prototype into a bank-grade production environment.

## Proposed Changes

We will implement 5 new modular architectural layers inside [donkai-prediction-market](file:///C:/Users/Kevan/.gemini/antigravity-ide/scratch/donkai-prediction-market).

---

### 1. Multi-Oracle Consensus & Arbitration State Machine

We will implement a weighted consensus engine that queries independent data sources and resolves disputes via a structured state machine.

#### [NEW] [oracle_consensus.js](file:///C:/Users/Kevan/.gemini/antigravity-ide/scratch/donkai-prediction-market/oracle_consensus.js)
- Implements the weighted $M$-of-$N$ consensus formula:
  $$\bar{O} = \frac{\sum w_i O_i}{\sum w_i}$$
- Defines a set of independent mock oracles:
  - Chainlink Feed (weight: 0.40)
  - Pyth Network (weight: 0.30)
  - Fed Reserve API parser (weight: 0.20)
  - TLSNotary assertions (weight: 0.10)
- Implements the complete arbitration lifecycle: `Active` ➔ `ConsensusEvaluation` ➔ `ChallengeWindow` ➔ `Disputed` ➔ `Arbitrated` ➔ `Disbursed`.
- Exposes `evaluateConsensus()` and `fileDispute()` APIs.

---

### 2. WebSocket Central Limit Order Book (CLOB) matching engine

We will upgrade the REST API polling model to a real-time price-time priority CLOB matching engine running over WebSocket gateway.

#### [NEW] [clob_server.js](file:///C:/Users/Kevan/.gemini/antigravity-ide/scratch/donkai-prediction-market/clob_server.js)
- Integrates a real-time `ws` server listening on port `3399`.
- Maintains structured sorted arrays for:
  - **Bids**: Sorted descending by price, then ascending by arrival timestamp.
  - **Asks**: Sorted ascending by price, then ascending by arrival timestamp.
- Evaluates immediate matching upon entry of new orders:
  - Crosses matches when Bid Price >= Ask Price.
  - Generates matched execution events.
- Broadcasts real-time L2 order book updates (`book_update` events) to all connected WebSocket clients.

---

### 3. Automated Delta-Hedging Execution Loop

We will bridge the advisory delta recommendations to automated execution wrappers simulating Jupiter/Coinbase Prime trade routes.

#### [NEW] [auto_hedge_executor.js](file:///C:/Users/Kevan/.gemini/antigravity-ide/scratch/donkai-prediction-market/auto_hedge_executor.js)
- Interfaces with the delta output from the Black-Scholes engine.
- Simulates routing calls to Jupiter API (Solana aggregator) and Coinbase Prime.
- Calculates slippage tolerances, fees, and outputs physical on-chain execution transaction IDs for confirmation.

---

### 4. End-of-Day (EOD) Rebalancing Scheduler

We will schedule a cron runner to trigger at 16:00 EST daily, checking delta positions and initiating BitGo Go Account-to-Vault transfers.

#### [NEW] [cron_rebalance_scheduler.js](file:///C:/Users/Kevan/.gemini/antigravity-ide/scratch/donkai-prediction-market/cron_rebalance_scheduler.js)
- Leverages `node-cron` to schedule execution.
- Triggers daily at 16:00 EST.
- Calls `/api/delta-hedging` to retrieve portfolio risk profiles.
- Initiates simulated BitGo Qualified Custody vault sweeps for markets requiring mark-to-market rebalancing.

---

### 5. Cryptographic Chained Ledger (Anti-Tampering)

We will secure the transaction ledger inside `default.json` by mathematically linking each entry to its predecessor using SHA-256 hash chaining.

#### [NEW] [cryptographic_ledger.js](file:///C:/Users/Kevan/.gemini/antigravity-ide/scratch/donkai-prediction-market/cryptographic_ledger.js)
- Implements SHA-256 chaining:
  $$H_k = \text{SHA256}\left( \text{Data}_k \parallel H_{k-1} \right)$$
- Exposes `appendAuditEntry()` and `verifyLedgerIntegrity()` methods.
- Validates the entire chain before allowing any BitGo disbursals.
- Simulates a tampering attempt to prove the verification engine detects modifications instantly.

---

## Verification Plan

### Automated Tests
We will build a single consolidation test runner [verify_production_stack.js](file:///C:/Users/Kevan/.gemini/antigravity-ide/scratch/donkai-prediction-market/verify_production_stack.js) that:
1. Feeds mock oracle inputs and evaluates the consensus threshold.
2. Connects a WebSocket client, submits matching buy/sell orders, and verifies L2 book updates.
3. Computes the delta-hedge requirement and simulates the routing swap execution.
4. Executes the 16:00 EST scheduler loop.
5. Appends entries to the cryptographic ledger, alters a historic block entry, and asserts that `verifyLedgerIntegrity()` correctly throws a chain-break warning.

### Manual Verification
- We will start the WebSocket server and audit server and monitor output logs.
