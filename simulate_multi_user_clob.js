import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMultiUserSimulation() {
  console.log(`========================================================================`);
  console.log(`🚀 STARTING MULTI-USER CLOB & CRYPTOGRAPHIC LEDGER SIMULATION`);
  console.log(`========================================================================`);

  const serverUrl = 'ws://localhost:3399';
  const restUrl = 'http://localhost:3388/api/wager';
  
  // 1. Establish WebSocket Connections for 3 distinct users
  console.log(`[Simulation Setup] Initializing real-time WebSocket connections...`);
  
  const alice = new WebSocket(serverUrl);
  const bob = new WebSocket(serverUrl);
  const charlie = new WebSocket(serverUrl);

  const waitForOpen = (socket, username) => {
    return new Promise((resolve) => {
      socket.on('open', () => {
        console.log(`   - Client Connected: ${username}`);
        resolve();
      });
    });
  };

  await Promise.all([
    waitForOpen(alice, 'user_maker_alice'),
    waitForOpen(bob, 'user_taker_bob'),
    waitForOpen(charlie, 'user_arbitrage_charlie')
  ]);

  // Set up broadcast message listeners
  alice.on('message', (data) => {
    const payload = JSON.parse(data);
    if (payload.event === 'book_update') {
      console.log(`\n📢 [Broadcast L2 Update]`);
      console.log(`   - Bids (Buy Desk):`, JSON.stringify(payload.bids));
      console.log(`   - Asks (Sell Desk):`, JSON.stringify(payload.asks));
      
      if (payload.trades && payload.trades.length > 0) {
        const lastTrade = payload.trades[payload.trades.length - 1];
        console.log(`⚡ [Real-time Match Caught]:`);
        console.log(`   - Price: $${lastTrade.price}`);
        console.log(`   - Size:  ${lastTrade.size} contracts`);
        console.log(`   - Bid:   ${lastTrade.bidId}`);
        console.log(`   - Ask:   ${lastTrade.askId}`);
      }
    }
  });

  // 2. Alice places a RESTING ASK limit order (selling 50 contracts at $0.62)
  console.log(`\n[User Actions] user_maker_alice places a resting SELL order...`);
  alice.send(JSON.stringify({
    action: 'limit_order',
    side: 'SELL',
    price: 0.62,
    size: 50,
    marketId: 'fit21'
  }));

  await new Promise(resolve => setTimeout(resolve, 800));

  // 3. Bob places a RESTING BID limit order (buying 30 contracts at $0.60)
  console.log(`\n[User Actions] user_taker_bob places a resting BUY order...`);
  bob.send(JSON.stringify({
    action: 'limit_order',
    side: 'BUY',
    price: 0.60,
    size: 30,
    marketId: 'fit21'
  }));

  await new Promise(resolve => setTimeout(resolve, 800));

  // 4. Charlie places a CROSSING BUY order (buying 60 contracts at $0.63)
  // This will cross Alice's ask at $0.62, leaving 10 BUY contracts at $0.63 in the book.
  console.log(`\n[User Actions] user_arbitrage_charlie places a crossing BUY order...`);
  charlie.send(JSON.stringify({
    action: 'limit_order',
    side: 'BUY',
    price: 0.63,
    size: 60,
    marketId: 'fit21'
  }));

  await new Promise(resolve => setTimeout(resolve, 1500));

  // Close Sockets
  alice.close();
  bob.close();
  charlie.close();

  // 5. Submit large wagers to trigger BitGo block sweep & verify cryptographic ledger chaining
  console.log(`\n========================================================================`);
  console.log(`🔒 TRIGGERING BITGO OTC BLOCK TRADE & LEDGER AUDIT HASH CHAIN`);
  console.log(`========================================================================`);

  console.log(`[User Actions] Submitting $105,000 USDC YES wager for fedrate...`);
  const response = await fetch(restUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'user_institutional_ld',
      name: 'LD Capital Principal Desk',
      side: 'YES',
      amount: 105000,
      market: 'fedrate'
    })
  });
  
  const result = await response.json();
  
  console.log(`\n[Broker Status] Wager processed.`);
  console.log(`   - Net YES Fedrate pool: $${result.allStats.fedrate.netYes.toLocaleString()} USDC`);
  console.log(`   - Block trade executed:`, result.blockExecuted);
  if (result.blockExecuted) {
    console.log(`   - Block Quote:         `, result.blockDetails.quoteId);
    console.log(`   - Qualified Address:   `, result.blockDetails.onchainDepositAddress);
  }

  // 6. View the cryptographic hash ledger status
  console.log(`\n[Ledger Verification] Querying cryptographic audit chain in default.json...`);
  const dbPath = path.join(__dirname, 'default.json');
  if (fs.existsSync(dbPath)) {
    const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    console.log(`   - Total audit blocks recorded: ${dbData.audit_trail.length}`);
    dbData.audit_trail.forEach((block, idx) => {
      console.log(`\n   Block ${idx}:`);
      console.log(`     - Event:      ${block.event}`);
      console.log(`     - Market:     ${block.market_id}`);
      console.log(`     - Cleared:    $${block.net_exposure_cleared.toLocaleString()} USDC`);
      console.log(`     - Prev Hash:  ${block.previous_hash ? block.previous_hash.substring(0, 16) + '...' : 'none'}`);
      console.log(`     - Current:    ${block.current_hash ? block.current_hash.substring(0, 16) + '...' : 'none'}`);
    });
  }

  console.log(`\n========================================================================`);
  console.log(`🎉 MULTI-USER CLOB & LEDGER SIMULATION CYCLE COMPLETE`);
  console.log(`========================================================================`);
}

runMultiUserSimulation();
