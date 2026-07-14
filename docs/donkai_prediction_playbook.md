# Unykorn Prediction Markets — DonKAI Strategic & Technical Playbook

This document outlines the architecture, execution models, and commercial potential for separating public event wagers (on independent brands like **donkai.org** or **drunks.app**) from Unykorn's core regulated institutional backend.

---

## 🏛️ Brand Separation & Regulatory Isolation

Integrating retail-facing prediction betting directly on core corporate properties (like Unykorn LLC or the "Men of God" charity hub) is a significant compliance risk. Instead, the architecture establishes strict structural boundaries:

```
                  ┌────────────────────────────────────────┐
                  │    Public Front-End (Retail / UI)       │
                  │   donkai.org  |  drunks.app  |  etc.    │
                  └───────────────────┬────────────────────┘
                                      │ (REST APIs)
                                      ▼
                  ┌────────────────────────────────────────┐
                  │    Unykorn Middleware Broker Engine    │
                  │  Nets flows internally, manages order  │
                  │  books, and runs the MtM risk routine  │
                  └───────────────────┬────────────────────┘
                                      │ (Regulated API Gateway)
                                      ▼
                  ┌────────────────────────────────────────┐
                  │   BitGo Parent-Child Custody Rails     │
                  │   Dedicated Qualified Custody Vaults   │
                  │   & Go Accounts backed by Susquehanna  │
                  └────────────────────────────────────────┘
```

1. **The Public Front-End (donkai.org):** A clean, high-performance web interface designed for retail macro traders. Users see event contracts, deposit funds, and buy YES/NO shares.
2. **The Unykorn Back-End:** Acts as the execution engine, balance-sheet manager, and custodian gateway. All customer balances are matched on an internal database ledger, and only netted block amounts are pushed to BitGo.

### 🏛️ The Regulated Institutional Custody Framework
To support institutional-tier counterparties, Unykorn anchors its back-end pipeline to the **BitGo Prime OTC Event Contract Framework**:
- **CFTC Swap Dealer de minimis Exemption**: BitGo Prime operates under the Commodity Futures Trading Commission's (CFTC) *de minimis* swap dealer exemption, permitting up to **$8 Billion in annualized notional volume** before requiring formal swap dealer registration. Our prediction market flow utilizes this exact regulatory wrapper.
- **Bilateral ISDA Documentation**: All institutional clients (Eligible Contract Participants, including hedge funds, family offices, neobanks) execute standard bilateral **ISDA (International Swaps and Derivatives Association)** derivatives agreements, treating wagers as contract-for-differences event swaps.
- **Riskless Principal Execution**: Unykorn interfaces with BitGo Prime as a riskless principal. When a block sweep is executed, Unykorn faces BitGo Prime as the immediate counterparty, and BitGo Prime separately clears the offsetting transaction on the back end with **Susquehanna Crypto (ECN)**, preventing Unykorn from taking direct market-maker inventory risk.
- **Multi-Asset Collateralization**: Instead of liquidating digital asset holdings to fund prediction contracts, clients can post USD, stablecoins, BTC, or native tokenized assets directly as collateral inside their secure Qualified Custody Vaults.

---

## 📊 Polymarket vs. Kalshi Architecture: Supporting Both Models

To build a world-class platform, you must understand the two standard execution frameworks for event-driven contracts and how Unykorn can run both under the hood:

### 1. Polymarket Model: Decentralized AMM
* **How it works:** Uses an **Automated Market Maker (AMM)** model. Wagers are deposited into smart contract pools (e.g. constant product $x \times y = k$). The ratio of YES and NO tokens in the liquidity pool determines the current contract price.
* **Pros:** Instantly boot-straps liquidity for niche events. No order-book matching lag.
* **Cons:** High slippage on large institutional trades; susceptible to pool manipulation.
* **Unykorn Support:** We deploy private liquidity pool contracts on Solana or EVM where Unykorn acts as the sole/primary Liquidity Provider (LP), capturing the trading fees.

### 2. Kalshi Model: Central Limit Order Book (CLOB)
* **How it works:** Matches buyers and sellers directly via a **Central Limit Order Book (CLOB)**. If you want to buy YES at $0.65, there must be a seller willing to sell NO at $0.35.
* **Pros:** Minimum slippage on large block wagers; preferred by hedge funds and professional desks.
* **Cons:** Requires deep, consistent liquidity to keep the spread tight.
* **Unykorn Support:** Unykorn, backed by **Susquehanna Crypto**, acts as the primary Market Maker on the order book. When there are no natural sellers, Unykorn fills the book dynamically using real-world metrics.

---

## ⚡ Potential Possibilities & Commercial Use Cases

By separating the public prediction front-end from the back-end, Unykorn opens up multiple high-yield revenue models:

### 1. Retail Netting & Yield Arbitrage (Unykorn Omnibus)
As shown in the [Netting Simulator](file:///C:/Users/Kevan/dev/core/pliny-lab/scripts/simulate_omnibus_netting.js), retail wagers are matched against each other internally.
- You sell YES shares to Alice at $0.65 and NO shares to Bob at $0.40 (implied 105% book).
- The extra 5% is your **arbitrage spread**.
- The cash is kept in Unykorn's Qualified Custody vault, earning **4.5% APR staking yield** while the contract runs.

### 2. B2B White-Labeling (Prediction-as-a-Service)
Other brands want to launch prediction markets but lack the legal entities, BitGo integration, or capital depth.
- **The Play:** You offer them the **Unykorn API Gateway**.
- **Revenue:** You charge a $5,000 integration fee, a $2,500/month SaaS fee, and take a 0.25% cut on all settlements. They keep their brand; you run the banking rails.

### 3. Corporate Macro Hedging (Custom Derivatives)
Many enterprises need to hedge real-world risks that traditional finance cannot cover (e.g., a green energy developer wants to hedge the risk of tax credit repeals).
- **The Play:** You issue a custom event contract on `donkai.org` (e.g. "Will the clean energy credit be repealed?").
- **Revenue:** The developer buys YES to hedge. Susquehanna provides the ask side. You lock the collateral under standard derivatives confirmations (ISDA), capturing the AUC fee.

### 4. Oracle Syndication & Consensus Fees
Unykorn can license the GMIIE consensus timeline data to other platforms.
- **The Play:** You act as the **Resolution Oracle** for external prediction markets, providing the final legislative or price data hash.
- **Revenue:** Collect a fee per query or a percentage of the total pool being resolved.

---

## 💼 Phase 4: Enterprise Partner Integration (LoanDepot, LD Capital, Dignity Gold)

To scale DonKAI for institutional-tier players like LoanDepot, LD Capital, and Dignity Gold, our operational framework extends beyond standard retail mechanics. We address their sophisticated capital requirements through three enterprise integration pillars:

### Pillar 1: Customized, High-Volume Hedging & Direct BitGo Sub-Accounts
Enterprise partners can execute large-scale risk mitigation strategies by utilizing dedicated, segregated BitGo sub-accounts. This setup enables them to:
- **Tailor Custom Derivatives**: Hedge specific, highly sensitive legislative, regulatory, or macroeconomic milestone risks at institutional ticket sizes ($\ge \$100\text{k}$).
- **Mitigate Counterparty Risk**: Collateral remains isolated within their own regulated Child Enterprise, eliminating platform-level commingling concerns.

### Pillar 2: Shared Custody Staking Yield Optimization
Large institutional partners lock significant volumes of collateral (USD, USDC, or tokenized gold assets like DIGau). We monetize and align this idle capital by:
- **Dynamic Yield Sharing**: Accruing a pro-rated staking yield (e.g., $4.5\%$ APR) directly within their Qualified Custody Vaults.
- **Fee Subsidization**: Using generated yields to programmatically offset their platform transaction fees or hedging margins, creating a highly cost-effective capital environment.

### Pillar 3: White-Label Risk Management Infrastructure (PaaS)
We offer a turn-key Platform-as-a-Service (PaaS) model, allowing enterprises to brand and deploy our prediction engine internally:
- **Corporate Risk Dashboard**: Custom UI and APIs skinned for internal executives, risk analysts, and traders.
- **Proprietary Oracle Inputs**: Plugging in private company metrics or specialized legislative monitors as consensus resolution sources.

---

## 🧮 Dynamic Leveraged Margin & Multi-Collateral Escrow Mechanics

To provide bank-grade capital efficiency, the Unykorn broker middleware implements a prime brokerage margin lending framework for event contracts.

### 1. Multi-Collateral Volatility Haircuts
Rather than liquidating custody assets, institutions can post diverse collateral. We apply standard prime-brokerage haircuts to protect the clearinghouse from spot market volatility:
- **USDC (Stablecoin)**: **0% Haircut** (1.00 margin valuation factor).
- **SOL (Solana)**: **15% Haircut** (0.85 margin valuation factor).
- **BTC (Bitcoin)**: **10% Haircut** (0.90 margin valuation factor).
- **DIGau (Dignity Gold)**: **10% Haircut** (0.90 margin valuation factor). Net value is computed using the real-time Gold Spot oracle feed.

### 2. Leveraged Position Sizing
Clients can select leverage multipliers $L$ from **1x to 10x**. The effective position size $S_{\text{position}}$ is defined as:
$$S_{\text{position}} = \text{Collateral Amount} \times \text{Valuation Factor} \times L$$

### 3. Staking Yield Offset
While positions are open, the net margin collateral remains in secure Qualified Custody, earning **4.5% APR staking yield**. This yield is accrued daily and programmatically offsets the broker's 0.25% ECN fee:
$$\text{Daily Yield} = \frac{\text{Net Margin Collateral} \times 0.045}{365}$$

### 4. Liquidation Odds Price Barrier
For leveraged contracts ($L > 1$), liquidation occurs when the contract odds move against the trader, depleting the margin collateral below the **10% maintenance margin** requirement. The liquidation price threshold $Odds_{\text{liq}}$ is calculated dynamically:
$$Odds_{\text{liq}} = Odds_{\text{entry}} \times \left( 1 - \frac{0.90}{L} \right)$$
If the L2 market odds breach this threshold, the position is programmatically liquidated, and the collateral is swept to Coinbase Prime/Jupiter for hedging.

---

## 🛠️ Standalone UI Verification

We have initialized a dedicated front-end directory for the separated brand:
- **Directory:** [donkai-prediction-market](file:///C:/Users/Kevan/.gemini/antigravity-ide/scratch/donkai-prediction-market/)
- **Index HTML:** [index.html](file:///C:/Users/Kevan/.gemini/antigravity-ide/scratch/donkai-prediction-market/index.html)
- **App Logic:** [app.js](file:///C:/Users/Kevan/.gemini/antigravity-ide/scratch/donkai-prediction-market/app.js)
- **Styles CSS:** [style.css](file:///C:/Users/Kevan/.gemini/antigravity-ide/scratch/donkai-prediction-market/style.css)

This standalone interface is currently served on **[http://localhost:9091](http://localhost:9091)** (Task ID `task-1777`). It includes an interactive betting slip demonstrating internal netting, leveraged payouts, collateral haircuts, ECN fees, and real-time custody ledger audits.
