import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class CryptographicLedger {
  constructor(dbFileName = 'default.json') {
    this.dbPath = path.join(__dirname, dbFileName);
  }

  // Generate SHA-256 hash of a string
  calculateHash(dataString) {
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  // Appends a new audit entry cryptographically linked to the previous one
  appendAuditEntry(eventData) {
    try {
      if (!fs.existsSync(this.dbPath)) {
        fs.writeFileSync(this.dbPath, JSON.stringify({ audit_trail: [] }, null, 2), 'utf8');
      }

      const fileContent = fs.readFileSync(this.dbPath, 'utf8');
      const dbData = JSON.parse(fileContent);

      if (!dbData.audit_trail) dbData.audit_trail = [];

      // Fetch the last entry's hash (genesis gets hash '0000000000000000000000000000000000000000000000000000000000000000')
      const lastEntry = dbData.audit_trail[dbData.audit_trail.length - 1];
      const previousHash = lastEntry ? lastEntry.current_hash : '0'.repeat(64);

      const auditEntry = {
        timestamp: new Date().toISOString(),
        event: eventData.event || "UNKNOWN_EVENT",
        market_id: eventData.market_id,
        net_exposure_cleared: eventData.net_exposure_cleared || 0,
        bitgo_quote_id: eventData.bitgo_quote_id || null,
        onchain_address_allocated: eventData.onchain_address_allocated || null,
        clearing_desk: eventData.clearing_desk || "Susquehanna ECN",
        previous_hash: previousHash,
        current_hash: ''
      };

      // Hash the contents combined with the previous hash: H_k = SHA256(Data_k || H_{k-1})
      const contentToHash = JSON.stringify({
        event: auditEntry.event,
        market_id: auditEntry.market_id,
        net_exposure_cleared: auditEntry.net_exposure_cleared,
        bitgo_quote_id: auditEntry.bitgo_quote_id,
        onchain_address_allocated: auditEntry.onchain_address_allocated,
        clearing_desk: auditEntry.clearing_desk
      }) + previousHash;

      auditEntry.current_hash = this.calculateHash(contentToHash);

      dbData.audit_trail.push(auditEntry);
      fs.writeFileSync(this.dbPath, JSON.stringify(dbData, null, 2), 'utf8');
      console.log(`🔒 [Cryptographic Ledger] Appended audit entry for event ${auditEntry.event}. Hash: ${auditEntry.current_hash.substring(0, 10)}...`);
      return auditEntry;
    } catch (err) {
      console.error("❌ [Cryptographic Ledger] Failed to append entry:", err.message);
      throw err;
    }
  }

  // Verifies the integrity of the entire chained ledger
  verifyLedgerIntegrity() {
    try {
      if (!fs.existsSync(this.dbPath)) {
        console.log(`⚠️ [Cryptographic Ledger] Database file does not exist at ${this.dbPath}. Integrity check skipped.`);
        return { success: true };
      }

      const fileContent = fs.readFileSync(this.dbPath, 'utf8');
      const dbData = JSON.parse(fileContent);

      if (!dbData.audit_trail || dbData.audit_trail.length === 0) {
        return { success: true, verifiedCount: 0 };
      }

      console.log(`[Cryptographic Ledger] Initiating validation of ${dbData.audit_trail.length} audit blocks...`);
      let expectedPreviousHash = '0'.repeat(64);

      for (let i = 0; i < dbData.audit_trail.length; i++) {
        const entry = dbData.audit_trail[i];

        // 1. Verify links
        if (entry.previous_hash !== expectedPreviousHash) {
          throw new Error(`Chain link broken at block index ${i}! Expected previous hash: ${expectedPreviousHash.substring(0, 10)}..., Found: ${entry.previous_hash.substring(0, 10)}...`);
        }

        // 2. Re-compute hash to verify data hasn't been altered
        const contentToHash = JSON.stringify({
          event: entry.event,
          market_id: entry.market_id,
          net_exposure_cleared: entry.net_exposure_cleared,
          bitgo_quote_id: entry.bitgo_quote_id,
          onchain_address_allocated: entry.onchain_address_allocated,
          clearing_desk: entry.clearing_desk
        }) + entry.previous_hash;

        const calculatedHash = this.calculateHash(contentToHash);

        if (calculatedHash !== entry.current_hash) {
          throw new Error(`Data corruption/tampering detected at block index ${i}! Stored Hash: ${entry.current_hash.substring(0, 10)}..., Calculated: ${calculatedHash.substring(0, 10)}...`);
        }

        expectedPreviousHash = entry.current_hash;
      }

      console.log(`✅ [Cryptographic Ledger] Database integrity verified! ${dbData.audit_trail.length} blocks fully authenticated.`);
      return { success: true, verifiedCount: dbData.audit_trail.length };
    } catch (err) {
      console.error(`🚨 [Cryptographic Ledger] INTEGRITY CHECK FAILURE: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
