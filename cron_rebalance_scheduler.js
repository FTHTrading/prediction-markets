import cron from 'node-cron';

export class RebalanceScheduler {
  constructor(port = 3388) {
    this.port = port;
    this.bitgoProxyUrl = 'http://localhost:3377';
    this.rebalanceHistory = [];
  }

  // Starts the cron scheduler
  initCron() {
    // Schedule to run Monday through Friday at exactly 16:00 EST
    // Note: To allow testing, we also expose a manual trigger method.
    cron.schedule('0 16 * * 1-5', async () => {
      console.log('\n[Rebalance Cron] Triggered: 16:00 EST Mark-to-Market rebalance loop...');
      await this.runRebalancingCycle();
    });
    console.log(`⏰ [Rebalance Cron] Scheduled Monday-Friday 16:00 EST mark-to-market loop.`);
  }

  // Executes a single rebalancing cycle
  async runRebalancingCycle() {
    console.log(`[Rebalance Cron] Probing delta-hedging risk profile on port ${this.port}...`);
    try {
      const response = await fetch(`http://localhost:${this.port}/api/delta-hedging`);
      const systemState = await response.json();

      if (!systemState.success) {
        throw new Error('Failed to retrieve correct delta state.');
      }

      console.log(`[Rebalance Cron] Risk state loaded. Analyzing portfolio exposure...`);
      const executions = [];

      for (const marketId in systemState.portfolioHedges) {
        const hedge = systemState.portfolioHedges[marketId];
        const rawRequired = hedge.hedgingVolumeRequired;
        
        // Threshold: only rebalance if the required volume is significant
        if (Math.abs(rawRequired) > 1.0) {
          const action = rawRequired > 0 ? 'SWEEP_GO_TO_VAULT' : 'SWEEP_VAULT_TO_GO';
          const transferAmount = Math.abs(rawRequired * hedge.underlyingSolSpotPrice || rawRequired);

          console.log(`⚡ [Rebalance Cron] Rebalancing Action required for ${marketId.toUpperCase()}:`);
          console.log(`   - Action:         ${action}`);
          console.log(`   - Amount:         $${transferAmount.toLocaleString()} USDC equivalent`);
          
          const transferResult = await this.executeBitGoCustodyTransfer(marketId, action, transferAmount);
          executions.push(transferResult);
        }
      }

      if (executions.length === 0) {
        console.log(`[Rebalance Cron] Portfolio fully aligned. No cash rebalancing required.`);
      }

      return executions;
    } catch (err) {
      console.error(`❌ [Rebalance Cron] Rebalancing cycle failed:`, err.message);
      return [];
    }
  }

  // Simulates the physical transfer between BitGo wallets
  async executeBitGoCustodyTransfer(marketId, action, amountUsdc) {
    const sourceWallet = action === 'SWEEP_GO_TO_VAULT' ? 'Unykorn-Go-Account-009' : 'Unykorn-Vault-Account-188';
    const destWallet = action === 'SWEEP_GO_TO_VAULT' ? 'Unykorn-Vault-Account-188' : 'Unykorn-Go-Account-009';

    console.log(`   - Initiating BitGo Qualified Custody Transfer:`);
    console.log(`     - Source Wallet: ${sourceWallet}`);
    console.log(`     - Dest Wallet:   ${destWallet}`);
    console.log(`     - Value:         $${amountUsdc.toFixed(2)} USDC`);

    // Simulate BitGo API request POST /api/v2/custody/transfer
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const bitgoTxId = `bitgo_transfer_tx_${Math.floor(Math.random() * 1e12)}`;
    console.log(`✅ [Rebalance Cron] BitGo custody settlement transfer completed. TxID: ${bitgoTxId}`);

    const record = {
      timestamp: new Date(),
      marketId,
      action,
      amountUsdc,
      bitgoTxId,
      status: 'SETTLED'
    };

    this.rebalanceHistory.push(record);
    return record;
  }
}
