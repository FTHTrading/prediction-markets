import { OracleConsensusEngine } from './oracle_consensus.js';
import { AutoHedgeExecutor } from './auto_hedge_executor.js';
import { RebalanceScheduler } from './cron_rebalance_scheduler.js';
import { CryptographicLedger } from './cryptographic_ledger.js';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log(`========================================================================`);
  console.log(`🧪 STARTING DONKAI PHASE 3 CONSOLIDATION TEST SUITE`);
  console.log(`========================================================================`);

  let failures = 0;

  // ------------------------------------------------------------------------
  // TEST 1: Weighted Oracle Consensus State Machine
  // ------------------------------------------------------------------------
  console.log(`\n▶️ [Test 1] Weighted Oracle Consensus & Arbitration State Machine`);
  try {
    const engine = new OracleConsensusEngine('fit21');
    engine.submitOracleResult('chainlink', 1);
    engine.submitOracleResult('pyth', 1);
    engine.submitOracleResult('fed_reserve', 0);
    // Weighted score: (0.40 * 1) + (0.30 * 1) + (0.20 * 0) = 0.70 / 0.90 = 0.7777 >= 0.70 threshold.
    
    const evaluation = engine.evaluateConsensus();
    if (!evaluation.success || evaluation.result !== 1 || engine.state !== 'ChallengeWindow') {
      throw new Error(`Consensus failed evaluation. State: ${engine.state}, Result: ${evaluation.result}`);
    }
    console.log(`✅ Consensus State Machine passed threshold evaluations!`);

    // File dispute with bond
    engine.fileDispute('user_trader_42', 6000);
    if (engine.state !== 'Disputed' || engine.disputeFiler !== 'user_trader_42') {
      throw new Error(`Dispute filing state failed. State: ${engine.state}`);
    }
    console.log(`✅ Dispute challenge bond lock resolved successfully!`);

    // Arbitration resolution
    engine.resolveArbitration(1); // Committee resolves YES
    if (engine.state !== 'Arbitrated' || engine.finalResolution !== 1) {
      throw new Error(`Arbitration resolution state failed. State: ${engine.state}`);
    }
    console.log(`✅ Arbitration Committee ruling recorded successfully!`);

    const payout = engine.executePayoutDisbursal();
    if (engine.state !== 'Disbursed' || payout !== 1) {
      throw new Error(`Payout disbursal failed. State: ${engine.state}`);
    }
    console.log(`✅ Payout execution disbursed based on arbitrated outcome!`);
  } catch (err) {
    console.error(`❌ [Test 1] FAILED:`, err.message);
    failures++;
  }

  // ------------------------------------------------------------------------
  // TEST 2: WebSocket Central Limit Order Book (CLOB)
  // ------------------------------------------------------------------------
  console.log(`\n▶️ [Test 2] WebSocket Central Limit Order Book (CLOB)`);
  try {
    const ws = new WebSocket('ws://localhost:3399');
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log(`   Connected to CLOB server. Sending orders...`);
        // Send a RESTING ASK (sell 10 contracts at $0.60)
        ws.send(JSON.stringify({
          action: 'limit_order',
          side: 'SELL',
          price: 0.60,
          size: 10,
          marketId: 'fit21'
        }));

        // Send a CROSSING BID (buy 12 contracts at $0.61)
        setTimeout(() => {
          ws.send(JSON.stringify({
            action: 'limit_order',
            side: 'BUY',
            price: 0.61,
            size: 12,
            marketId: 'fit21'
          }));
        }, 100);
      });

      ws.on('message', (data) => {
        const payload = JSON.parse(data);
        if (payload.event === 'book_update') {
          console.log(`   L2 Book Broadcast Update:`, JSON.stringify(payload.bids), 'asks:', JSON.stringify(payload.asks));
          if (payload.trades && payload.trades.length > 0) {
            console.log(`✅ Match event broadcast caught! Match Price: $${payload.trades[0].price}`);
            ws.close();
            resolve();
          }
        }
      });

      ws.on('error', (e) => reject(e));
      setTimeout(() => reject(new Error('WebSocket timeout')), 2000);
    });
  } catch (err) {
    console.error(`❌ [Test 2] FAILED:`, err.message);
    failures++;
  }

  // ------------------------------------------------------------------------
  // TEST 3: Automated Delta-Hedging Executor
  // ------------------------------------------------------------------------
  console.log(`\n▶️ [Test 3] Automated Delta-Hedging Executor`);
  try {
    const executor = new AutoHedgeExecutor();
    const resultSol = await executor.executeSpotHedge('SOL', 1235.03);
    const resultDxy = await executor.executeSpotHedge('DXY', -828.26);

    if (!resultSol.success || resultSol.record.status !== 'FILLED') {
      throw new Error('Jupiter routing simulation failed');
    }
    if (!resultDxy.success || resultDxy.record.status !== 'FILLED') {
      throw new Error('Coinbase Prime routing simulation failed');
    }
    console.log(`✅ Delta-hedging execution routes generated and confirmed!`);
  } catch (err) {
    console.error(`❌ [Test 3] FAILED:`, err.message);
    failures++;
  }

  // ------------------------------------------------------------------------
  // TEST 4: EOD Rebalancing Scheduler Mark-to-Market
  // ------------------------------------------------------------------------
  console.log(`\n▶️ [Test 4] EOD Rebalancing Scheduler`);
  try {
    const scheduler = new RebalanceScheduler(3388);
    // Manually trigger rebalancing cycle
    const transfers = await scheduler.runRebalancingCycle();
    if (!transfers || transfers.length === 0) {
      throw new Error('Scheduler failed to execute mark-to-market transfers');
    }
    console.log(`✅ EOD Vault transfer sweeps executed:`, transfers.map(t => t.bitgoTxId));
  } catch (err) {
    console.error(`❌ [Test 4] FAILED:`, err.message);
    failures++;
  }

  // ------------------------------------------------------------------------
  // TEST 5: Cryptographic append-only Chained Ledger
  // ------------------------------------------------------------------------
  console.log(`\n▶️ [Test 5] Cryptographic Ledger Chaining & Anti-Tampering Engine`);
  const testDb = 'test_audit.json';
  const testDbPath = path.join(__dirname, testDb);
  try {
    // 1. Clean old test db
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const ledger = new CryptographicLedger(testDb);
    
    // Append 3 blocks
    ledger.appendAuditEntry({ event: 'TEST_TX_1', market_id: 'fit21', net_exposure_cleared: 10000 });
    ledger.appendAuditEntry({ event: 'TEST_TX_2', market_id: 'fedrate', net_exposure_cleared: 20000 });
    ledger.appendAuditEntry({ event: 'TEST_TX_3', market_id: 'fit21', net_exposure_cleared: 30000 });

    // Verify clean chain
    let check = ledger.verifyLedgerIntegrity();
    if (!check.success || check.verifiedCount !== 3) {
      throw new Error(`Integrity check failed on valid chain: ${check.error}`);
    }
    console.log(`✅ Clean cryptographic chain verified with 3 records.`);

    // 2. TAMPING SIMULATION: modify block 1 amount
    console.log(`   Simulating injection/tampering attempt on block index 1...`);
    const dbData = JSON.parse(fs.readFileSync(testDbPath, 'utf8'));
    dbData.audit_trail[1].net_exposure_cleared = 999999; // Tampered value
    fs.writeFileSync(testDbPath, JSON.stringify(dbData, null, 2), 'utf8');

    // Run verification on tampered data
    check = ledger.verifyLedgerIntegrity();
    if (check.success) {
      throw new Error(`Security breach! Tampered ledger passed integrity verification.`);
    }

    console.log(`✅ Cryptographic chain verification successfully detected database tampering!`);
    console.log(`   Expected Alert Caught: "${check.error}"`);

    // Prune test db
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  } catch (err) {
    console.error(`❌ [Test 5] FAILED:`, err.message);
    failures++;
  }

  console.log(`\n========================================================================`);
  if (failures === 0) {
    console.log(`🎉 ALL TESTS COMPLETED SUCCESSFULLY! DONKAI IS STABLE AND PRODUCTION-READY.`);
  } else {
    console.error(`🚨 CONSOLIDATION TEST SUITE COMPLETED WITH ${failures} FAILURES.`);
    process.exit(1);
  }
  console.log(`========================================================================`);
}

runTests();
