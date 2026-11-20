-- Musclog Premium ledger (docs/plans/musclog-premium.md section 9, revision 3).
-- Seeded from spikes/premium-p0/ledger/schema.sql, with the revision 3 changes:
--   devices: no one-active-device index (up to MAX_DEVICES per lineage, LRU by last_nonce_ts),
--            last_nonce_ts (monotonic, single-use nonces), devices_lineage index.
--   periods: net_proceeds_u and the financial CHECK on it; rc_subscription_id for re-verification.
--   reservations: body_hash binds an Idempotency-Key to its allowlisted body (422 on reuse).
-- The CHECK constants follow the config (SPEND_SHARE 0.5 -> 500, OpenRouter fee 1.055 -> 1055);
-- changing either needs a new migration. Migrations are additive only. No prompts, responses,
-- images, IPs or store receipts are ever stored.

CREATE TABLE devices (
  rc_id         TEXT PRIMARY KEY,
  public_key    BLOB NOT NULL,
  lineage_key   TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('active','revoked')),
  last_nonce_ts INTEGER NOT NULL DEFAULT 0,
  verified_at   INTEGER NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE INDEX devices_lineage ON devices(lineage_key);

CREATE TABLE periods (
  payment_key        TEXT PRIMARY KEY,
  lineage_key        TEXT NOT NULL,
  rc_subscription_id TEXT NOT NULL,
  store              TEXT NOT NULL CHECK (store IN ('app_store','play_store')),
  period_start       INTEGER NOT NULL,
  period_end         INTEGER NOT NULL,
  proceeds_u         INTEGER NOT NULL CHECK (proceeds_u > 0),
  net_proceeds_u     INTEGER NOT NULL CHECK (net_proceeds_u > 0),
  cap_u              INTEGER NOT NULL,
  early_cap_u        INTEGER NOT NULL,
  early_until        INTEGER NOT NULL,
  daily_cap_u        INTEGER NOT NULL,
  spent_u            INTEGER NOT NULL DEFAULT 0,
  reserved_u         INTEGER NOT NULL DEFAULT 0 CHECK (reserved_u >= 0),
  inflight           INTEGER NOT NULL DEFAULT 0 CHECK (inflight >= 0),
  day                TEXT NOT NULL DEFAULT '',
  day_spent_u        INTEGER NOT NULL DEFAULT 0,
  day_requests       INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  last_activity_at   INTEGER NOT NULL DEFAULT 0,
  created_at         INTEGER NOT NULL,
  CHECK (cap_u * 1055 <= net_proceeds_u * 500),
  CHECK (net_proceeds_u <= proceeds_u)
) WITHOUT ROWID;
CREATE INDEX periods_lineage ON periods(lineage_key);
CREATE INDEX periods_end ON periods(period_end);   -- cron and prune touch only live/old periods

CREATE TABLE reservations (
  payment_key TEXT NOT NULL,
  req_id      TEXT NOT NULL,
  body_hash   TEXT NOT NULL,
  reserved_u  INTEGER NOT NULL,
  settled_u   INTEGER,
  state       TEXT NOT NULL CHECK (state IN ('pending','held','settled','refunded','expired')),
  hold_token  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  settled_at  INTEGER,
  PRIMARY KEY (payment_key, req_id)
) WITHOUT ROWID;

-- Keys: breaker ('open' | 'closed'), breaker_reason, daily_full ('0' | '1'),
-- accepting_new ('0' | '1'), overruns (JSON array of ms timestamps in the last 24 h),
-- recon (JSON {usage_u, at}: the last reconciliation's OpenRouter cumulative usage).
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
