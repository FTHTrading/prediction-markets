/**
 * DonKAI Multi-Oracle Consensus & Arbitration State Machine
 * Implements weighted M-of-N consensus and structured dispute/arbitration workflows.
 */

export class OracleConsensusEngine {
  constructor(marketId, threshold = 0.70) {
    this.marketId = marketId;
    this.threshold = threshold;
    this.state = 'Active'; // Active, ConsensusEvaluation, ChallengeWindow, Disputed, Arbitrated, Disbursed
    this.disputeBondUsdc = 5000; // Requirement to file challenge
    this.disputeFiler = null;
    
    // Configured High-Integrity Oracles with credibility weights
    this.oracles = [
      { id: 'chainlink', name: 'Chainlink Data Feed', weight: 0.40, resolved: null },
      { id: 'pyth', name: 'Pyth Network SOL/USD Feed', weight: 0.30, resolved: null },
      { id: 'fed_reserve', name: 'Federal Reserve API Parser', weight: 0.20, resolved: null },
      { id: 'tls_notary', name: 'TLSNotary Web Attestation', weight: 0.10, resolved: null }
    ];

    this.consensusResult = null;
    this.finalResolution = null;
  }

  // 1. Ingest oracle resolutions
  submitOracleResult(oracleId, resolvedValue) {
    const oracle = this.oracles.find(o => o.id === oracleId);
    if (!oracle) throw new Error(`Unknown oracle identifier: ${oracleId}`);
    
    oracle.resolved = resolvedValue; // 1 for YES, 0 for NO
    console.log(`[Oracle Ingest] ${oracle.name} submitted response for ${this.marketId}: ${resolvedValue === 1 ? 'YES' : 'NO'}`);
  }

  // 2. Compute weighted consensus
  evaluateConsensus() {
    this.state = 'ConsensusEvaluation';
    let totalWeight = 0;
    let weightedSum = 0;
    let completedCount = 0;

    for (const oracle of this.oracles) {
      if (oracle.resolved !== null) {
        weightedSum += oracle.weight * oracle.resolved;
        totalWeight += oracle.weight;
        completedCount++;
      }
    }

    if (completedCount < 3) {
      console.log(`[Consensus Engine] Insufficient reporting sources (${completedCount}/${this.oracles.length}). Transitioning to Dispute.`);
      this.state = 'Disputed';
      return { success: false, reason: 'Insufficient active oracles' };
    }

    const consensusScore = weightedSum / totalWeight;
    console.log(`[Consensus Engine] Evaluated consensus score for ${this.marketId}: ${consensusScore.toFixed(4)} (Threshold: ${this.threshold})`);

    if (consensusScore >= this.threshold) {
      this.consensusResult = 1; // YES
      this.state = 'ChallengeWindow';
      console.log(`[Consensus Engine] Consensus achieved: YES. Entering 24-Hour Dispute Challenge Window.`);
    } else if (consensusScore <= (1 - this.threshold)) {
      this.consensusResult = 0; // NO
      this.state = 'ChallengeWindow';
      console.log(`[Consensus Engine] Consensus achieved: NO. Entering 24-Hour Dispute Challenge Window.`);
    } else {
      // Indeterminate split (e.g., 0.50 score). Escalates to Dispute.
      this.state = 'Disputed';
      console.log(`[Consensus Engine] Consensus split/indeterminate (${consensusScore.toFixed(2)}). Escalating to Dispute.`);
    }

    return {
      success: this.state === 'ChallengeWindow',
      score: consensusScore,
      result: this.consensusResult,
      state: this.state
    };
  }

  // 3. User files dispute with required bond
  fileDispute(userId, bondAmount) {
    if (this.state !== 'ChallengeWindow') {
      throw new Error(`Dispute filing is only allowed during ChallengeWindow. Current state: ${this.state}`);
    }

    if (bondAmount < this.disputeBondUsdc) {
      throw new Error(`Insufficient dispute bond. Required: $${this.disputeBondUsdc} USDC`);
    }

    this.state = 'Disputed';
    this.disputeFiler = userId;
    console.log(`🚨 [Dispute Triggered] User ${userId} disputed resolution for ${this.marketId}. Dispute Bond locked: $${bondAmount} USDC.`);
  }

  // 4. Manual Arbitration Committee resolve
  resolveArbitration(committeeVote) {
    if (this.state !== 'Disputed') {
      throw new Error(`Arbitration resolution only allowed in Disputed state. Current state: ${this.state}`);
    }

    this.state = 'Arbitrated';
    this.finalResolution = committeeVote; // 1 for YES, 0 for NO
    console.log(`🏛️ [Arbitration Complete] Committee ruled outcome for ${this.marketId}: ${committeeVote === 1 ? 'YES' : 'NO'}`);
  }

  // 5. Final Disbursement
  executePayoutDisbursal() {
    if (this.state !== 'ChallengeWindow' && this.state !== 'Arbitrated') {
      throw new Error(`Payout cannot be disbursed in state: ${this.state}`);
    }

    if (this.state === 'ChallengeWindow') {
      this.finalResolution = this.consensusResult;
    }

    this.state = 'Disbursed';
    console.log(`💰 [BitGo Disbursal] Executed payout transfers for ${this.marketId} based on outcome: ${this.finalResolution === 1 ? 'YES' : 'NO'}`);
    return this.finalResolution;
  }
}
