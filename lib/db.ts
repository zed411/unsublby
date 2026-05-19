import Database from "better-sqlite3";
import { join } from "node:path";

type Db = Database.Database;

let db: Db | null = null;

export function getDb() {
  if (!db) {
    db = new Database(join(process.cwd(), "unsubly.local.db"));
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS unlocks (
        identity_hash TEXT PRIMARY KEY,
        identity_hint TEXT NOT NULL,
        stripe_session_id TEXT,
        paid_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  return db;
}

export function markDeepSearchUnlocked(identityHash: string, identityHint: string, stripeSessionId: string) {
  getDb()
    .prepare(
      `
      INSERT INTO unlocks (identity_hash, identity_hint, stripe_session_id, paid_at)
      VALUES (@identityHash, @identityHint, @stripeSessionId, @paidAt)
      ON CONFLICT(identity_hash) DO UPDATE SET
        stripe_session_id = excluded.stripe_session_id,
        paid_at = excluded.paid_at
    `
    )
    .run({
      identityHash,
      identityHint,
      stripeSessionId,
      paidAt: new Date().toISOString()
    });
}

export function isDeepSearchUnlocked(identityHash: string) {
  const row = getDb().prepare("SELECT identity_hash FROM unlocks WHERE identity_hash = ?").get(identityHash);
  return Boolean(row);
}
