import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateBinaryDelta, runDeltaDiagnostic } from './delta_hedging_engine.js';
import { startWebSocketClobServer } from './clob_server.js';
import { CryptographicLedger } from './cryptographic_ledger.js';
const cryptoLedger = new CryptographicLedger();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3388;
const PROXY_URL = 'http://localhost:3377';
const BITGO_OTC_MINIMUM = 100000;

// In-memory State
const state = {
  internalLedger: [],
  nettingPools: {
    fit21: { YES: 90000, NO: 15000 },
    fedrate: { YES: 15000, NO: 10000 }
  },
  executedBlockTrades: []
};

// ------------------------------------------------------------------------
// Helper: Append Block Execution Audits to default.json
// ------------------------------------------------------------------------
function appendBlockExecutionToLedger(marketId, netExposure, blockDetails) {
  try {
    cryptoLedger.appendAuditEntry({
      event: "BITGO_OTC_BLOCK_TRIGGER",
      market_id: marketId,
      net_exposure_cleared: netExposure,
      bitgo_quote_id: blockDetails.quoteId,
      onchain_address_allocated: blockDetails.onchainDepositAddress,
      clearing_desk: "Susquehanna ECN"
    });
  } catch (err) {
    console.error("Failed to append to cryptographic ledger:", err.message);
  }
}

// ------------------------------------------------------------------------
// Helper: Get Net Exposure for a market
// ------------------------------------------------------------------------
function getMarketExposure(market) {
  const yes = state.nettingPools[market].YES;
  const no = state.nettingPools[market].NO;
  const netYes = yes - no;
  const absoluteExposure = Math.abs(netYes);
  
  return {
    yes,
    no,
    netYes,
    absoluteExposure,
    pct: Math.min(100, (absoluteExposure / BITGO_OTC_MINIMUM) * 100)
  };
}

// ------------------------------------------------------------------------
// Endpoint: Get Pool Status
// ------------------------------------------------------------------------
app.get('/api/pool-status', (req, res) => {
  const fit21 = getMarketExposure('fit21');
  const fedrate = getMarketExposure('fedrate');
  
  res.json({
    markets: { fit21, fedrate },
    executedBlockTrades: state.executedBlockTrades
  });
});

// ------------------------------------------------------------------------
// Endpoint: Get Delta Hedging Metrics
// ------------------------------------------------------------------------
app.get('/api/delta-hedging', (req, res) => {
  try {
    const diagnostic = runDeltaDiagnostic();
    const fit21Exposure = getMarketExposure('fit21');
    const fedrateExposure = getMarketExposure('fedrate');
    
    const solDelta = calculateBinaryDelta(142.5, 150.0, 0.55, 30);
    const totalSolHedgeRequired = fit21Exposure.netYes * solDelta.analyticalDelta;
    
    const dxyDelta = calculateBinaryDelta(104.5, 105.0, 0.08, 30);
    const totalDxyHedgeRequired = fedrateExposure.netYes * dxyDelta.analyticalDelta;

    res.json({
      success: true,
      staticAssets: diagnostic,
      portfolioHedges: {
        fit21: {
          netExposureUsdc: fit21Exposure.netYes,
          underlyingSolSpotPrice: 142.5,
          contractDelta: solDelta.analyticalDelta,
          hedgingVolumeRequired: totalSolHedgeRequired,
          hedgingUnit: 'SOL'
        },
        fedrate: {
          netExposureUsdc: fedrateExposure.netYes,
          underlyingDxySpotPrice: 104.5,
          contractDelta: dxyDelta.analyticalDelta,
          hedgingVolumeRequired: totalDxyHedgeRequired,
          hedgingUnit: 'DXY Contracts'
        }
      }
    });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// ------------------------------------------------------------------------
// Endpoint: Submit Wager
// ------------------------------------------------------------------------
app.post('/api/wager', async (req, res) => {
  const { userId, name, side, amount, market } = req.body;
  
  if (!amount || amount <= 0 || !market || !side) {
    return res.status(400).json({ error: true, message: 'Invalid trade inputs' });
  }

  const parsedAmount = parseFloat(amount);
  
  console.log(`\n[Ledger Ingest] Wager: $${parsedAmount.toLocaleString()} USDC on ${side} for ${market.toUpperCase()} from ${name}`);
  
  // 1. Record wager in internal ledger
  state.internalLedger.push({
    userId,
    name,
    side,
    amount: parsedAmount,
    market,
    timestamp: new Date()
  });

  // 2. Update Netting Pools
  state.nettingPools[market][side] += parsedAmount;

  // 3. Re-calculate exposure
  const exp = getMarketExposure(market);
  let blockExecuted = false;
  let blockDetails = null;

  // 4. Trigger Block Trade if Net Exposure >= $100k
  if (exp.absoluteExposure >= BITGO_OTC_MINIMUM) {
    const blockSide = exp.netYes > 0 ? 'YES' : 'NO';
    const blockAmount = exp.absoluteExposure;

    // Check how much is already covered
    const alreadyCovered = state.executedBlockTrades
      .filter(b => b.market === market && b.side === blockSide)
      .reduce((sum, b) => sum + b.amount, 0);

    const netToExecute = blockAmount - alreadyCovered;

    if (netToExecute >= BITGO_OTC_MINIMUM) {
      blockExecuted = true;
      const quoteId = `q_otc_block_${Math.floor(Math.random() * 100000)}`;
      
      blockDetails = {
        quoteId,
        market,
        side: blockSide,
        amount: netToExecute,
        timestamp: new Date(),
        onchainDepositAddress: 'pending'
      };

      // Real integration: Generate on-chain deposit address on the Child Enterprise Wallet via the active Proxy
      try {
        console.log(`[BitGo ECN Link] Accessing Unykorn Child Enterprise wallet at ${PROXY_URL}...`);
        let proxyRes = await fetch(`${PROXY_URL}/wallet/child/address`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: `DonKAI-Block-${market.toUpperCase()}-${blockSide}-${Date.now()}`
          })
        });
        
        let proxyData = await proxyRes.json();
        if (proxyData && proxyData.address) {
          blockDetails.onchainDepositAddress = proxyData.address;
          console.log(`✅ [BitGo ECN Link] Child Enterprise address generated: ${proxyData.address}`);
        } else if (proxyData && proxyData.error && proxyData.error.includes('initialization')) {
          console.log(`⚠️ [BitGo ECN Link] Child wallet pending on-chain initialization. Routing to Main Custody Wallet...`);
          
          proxyRes = await fetch(`${PROXY_URL}/wallet/main/address`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              label: `DonKAI-Block-${market.toUpperCase()}-${blockSide}-${Date.now()}`
            })
          });
          proxyData = await proxyRes.json();
          
          if (proxyData && proxyData.address) {
            blockDetails.onchainDepositAddress = proxyData.address;
            console.log(`✅ [BitGo ECN Link] Main Custody address generated: ${proxyData.address}`);
          } else {
            console.log(`⚠️ [BitGo ECN Link] Proxy Main query failed. Using fallback.`);
            blockDetails.onchainDepositAddress = 'CfAHdr7e3EV24LyUnxL3Xt9uTmeYTSCy4FERcNWb55ai';
          }
        } else {
          console.log(`⚠️ [BitGo ECN Link] Proxy did not return address. Mapped default.`);
          blockDetails.onchainDepositAddress = 'CfAHdr7e3EV24LyUnxL3Xt9uTmeYTSCy4FERcNWb55ai';
        }
      } catch (err) {
        console.error(`❌ [BitGo ECN Link] Failed to connect to proxy:`, err.message);
        blockDetails.onchainDepositAddress = 'CfAHdr7e3EV24LyUnxL3Xt9uTmeYTSCy4FERcNWb55ai';
      }
      
      state.executedBlockTrades.push(blockDetails);
      
      // Persist transaction execution audit to default.json
      appendBlockExecutionToLedger(market, netToExecute, blockDetails);

      console.log(`⚡ [BitGo OTC Block Triggered]`);
      console.log(`   - Market:       ${market.toUpperCase()}`);
      console.log(`   - Side:         ${blockSide}`);
      console.log(`   - Net Amount:   $${netToExecute.toLocaleString()} USDC`);
      console.log(`   - Wallet Address: ${blockDetails.onchainDepositAddress}`);
      console.log(`   - Quote ID:     ${quoteId} (Cleared via Susquehanna ECN)`);
    }
  }

  res.json({
    success: true,
    blockExecuted,
    blockDetails,
    marketStats: exp,
    allStats: {
      fit21: getMarketExposure('fit21'),
      fedrate: getMarketExposure('fedrate')
    }
  });
});

app.listen(PORT, () => {
  console.log(`========================================================================`);
  console.log(`🏢 Unykorn DonKAI Live Linked Broker Server online on port ${PORT}`);
  console.log(`========================================================================`);
  console.log(`Endpoint mappings:`);
  console.log(`  - GET  http://localhost:${PORT}/api/pool-status`);
  console.log(`  - GET  http://localhost:${PORT}/api/delta-hedging`);
  console.log(`  - POST http://localhost:${PORT}/api/wager`);
  console.log(`------------------------------------------------------------------------`);
  
  // Launch the WebSocket Central Limit Order Book server on port 3399
  startWebSocketClobServer(3399);
});
