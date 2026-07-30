import Database from "better-sqlite3";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { join } from "node:path";
import { Pool } from "pg";

type SqliteDb = Database.Database;

let sqliteDb: SqliteDb | null = null;
let pgPool: Pool | null = null;
let pgReady = false;

export type EmailConnection = {
  user_id: string;
  provider: "google";
  email: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: number;
  connected_at: string;
  updated_at: string;
};

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function usePostgres() {
  return Boolean(databaseUrl());
}

export function getStorageMode() {
  return usePostgres() ? "postgres" : "sqlite";
}

let warnedAboutTokenKeyFallback = false;

function tokenKey() {
  const secret =
    process.env.EMAIL_TOKEN_ENCRYPTION_KEY ||
    process.env.EMAIL_OAUTH_STATE_SECRET ||
    process.env.CLERK_SECRET_KEY ||
    "local-dev-token-key";

  if (!process.env.EMAIL_TOKEN_ENCRYPTION_KEY && process.env.NODE_ENV === "production" && !warnedAboutTokenKeyFallback) {
    warnedAboutTokenKeyFallback = true;
    console.warn(
      "EMAIL_TOKEN_ENCRYPTION_KEY is not set. OAuth tokens are being encrypted with a fallback key; rotating that fallback secret will make stored tokens unreadable."
    );
  }

  return createHash("sha256").update(secret).digest();
}

function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptToken(token: string | null) {
  if (!token) return null;
  if (!token.startsWith("enc:")) return token;

  const [, ivValue, tagValue, encryptedValue] = token.split(":");
  if (!ivValue || !tagValue || !encryptedValue) return null;

  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function getDb() {
  if (!sqliteDb) {
    sqliteDb = new Database(join(process.cwd(), "unsubly.local.db"));
    sqliteDb.pragma("journal_mode = WAL");
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS unlocks (
        identity_hash TEXT PRIMARY KEY,
        identity_hint TEXT NOT NULL,
        stripe_session_id TEXT,
        paid_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_connections (
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        email TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at INTEGER NOT NULL,
        connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, provider)
      );
    `);
  }

  return sqliteDb;
}

function getPgPool() {
  if (!pgPool) {
    pgPool = new Pool({
      connectionString: databaseUrl(),
      ssl: { rejectUnauthorized: false }
    });
  }

  return pgPool;
}

async function ensurePgReady() {
  if (pgReady) return;

  await getPgPool().query(`
    CREATE TABLE IF NOT EXISTS unlocks (
      identity_hash TEXT PRIMARY KEY,
      identity_hint TEXT NOT NULL,
      stripe_session_id TEXT,
      paid_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS email_connections (
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      email TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at BIGINT NOT NULL,
      connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, provider)
    );
  `);
  pgReady = true;
}

export async function markDeepSearchUnlocked(identityHash: string, identityHint: string, stripeSessionId: string) {
  const paidAt = new Date().toISOString();

  if (usePostgres()) {
    await ensurePgReady();
    await getPgPool().query(
      `
      INSERT INTO unlocks (identity_hash, identity_hint, stripe_session_id, paid_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT(identity_hash) DO UPDATE SET
        stripe_session_id = excluded.stripe_session_id,
        paid_at = excluded.paid_at
    `,
      [identityHash, identityHint, stripeSessionId, paidAt]
    );
    return;
  }

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
    .run({ identityHash, identityHint, stripeSessionId, paidAt });
}

export async function isDeepSearchUnlocked(identityHash: string) {
  if (usePostgres()) {
    await ensurePgReady();
    const result = await getPgPool().query("SELECT identity_hash FROM unlocks WHERE identity_hash = $1", [identityHash]);
    return Boolean(result.rowCount);
  }

  const row = getDb().prepare("SELECT identity_hash FROM unlocks WHERE identity_hash = ?").get(identityHash);
  return Boolean(row);
}

export async function saveEmailConnection(connection: {
  userId: string;
  provider: "google";
  email: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: number;
}) {
  const encryptedAccessToken = encryptToken(connection.accessToken);
  const encryptedRefreshToken = connection.refreshToken ? encryptToken(connection.refreshToken) : null;

  if (usePostgres()) {
    await ensurePgReady();
    await getPgPool().query(
      `
      INSERT INTO email_connections (user_id, provider, email, access_token, refresh_token, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT(user_id, provider) DO UPDATE SET
        email = excluded.email,
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, email_connections.refresh_token),
        expires_at = excluded.expires_at,
        updated_at = CURRENT_TIMESTAMP
    `,
      [
        connection.userId,
        connection.provider,
        connection.email,
        encryptedAccessToken,
        encryptedRefreshToken,
        connection.expiresAt
      ]
    );
    return;
  }

  getDb()
    .prepare(
      `
      INSERT INTO email_connections (user_id, provider, email, access_token, refresh_token, expires_at)
      VALUES (@userId, @provider, @email, @accessToken, @refreshToken, @expiresAt)
      ON CONFLICT(user_id, provider) DO UPDATE SET
        email = excluded.email,
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, email_connections.refresh_token),
        expires_at = excluded.expires_at,
        updated_at = CURRENT_TIMESTAMP
    `
    )
    .run({
      ...connection,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken
    });
}

export async function getEmailConnection(userId: string, provider: "google") {
  let row: EmailConnection | undefined;

  if (usePostgres()) {
    await ensurePgReady();
    const result = await getPgPool().query("SELECT * FROM email_connections WHERE user_id = $1 AND provider = $2", [
      userId,
      provider
    ]);
    row = result.rows[0] as EmailConnection | undefined;
  } else {
    row = getDb()
      .prepare("SELECT * FROM email_connections WHERE user_id = ? AND provider = ?")
      .get(userId, provider) as EmailConnection | undefined;
  }

  if (!row) return undefined;
  return {
    ...row,
    expires_at: Number(row.expires_at),
    access_token: decryptToken(row.access_token) || "",
    refresh_token: decryptToken(row.refresh_token)
  };
}

export async function hasEmailConnection(userId: string, provider: "google") {
  if (usePostgres()) {
    await ensurePgReady();
    const result = await getPgPool().query("SELECT user_id FROM email_connections WHERE user_id = $1 AND provider = $2", [
      userId,
      provider
    ]);
    return Boolean(result.rowCount);
  }

  const row = getDb()
    .prepare("SELECT user_id FROM email_connections WHERE user_id = ? AND provider = ?")
    .get(userId, provider);
  return Boolean(row);
}

export async function deleteEmailConnection(userId: string, provider: "google") {
  if (usePostgres()) {
    await ensurePgReady();
    await getPgPool().query("DELETE FROM email_connections WHERE user_id = $1 AND provider = $2", [userId, provider]);
    return;
  }

  getDb().prepare("DELETE FROM email_connections WHERE user_id = ? AND provider = ?").run(userId, provider);
}

export async function testDatabaseConnection() {
  try {
    if (usePostgres()) {
      await ensurePgReady();
      await getPgPool().query("SELECT 1");
    } else {
      getDb().prepare("SELECT 1").get();
    }
    return true;
  } catch (error) {
    console.error("Database readiness check failed", error);
    return false;
  }
}
