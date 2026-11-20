-- Plan section 9 tables with the P0 changes: reservations.state adds 'pending', settle_token dropped.
CREATE TABLE devices (
  rc_id        TEXT PRIMARY KEY,
  public_key   BLOB NOT NULL,
  lineage_key  TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('active','revoked')),
  verified_at  INTEGER NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE UNIQUE INDEX devices_one_active ON devices(lineage_key) WHERE status = 'active';

CREATE TABLE periods (
  payment_key   TEXT PRIMARY KEY,
  lineage_key   TEXT NOT NULL,
  store         TEXT NOT NULL CHECK (store IN ('app_store','play_store')),
  period_start  INTEGER NOT NULL,  period_end INTEGER NOT NULL,
  proceeds_u    INTEGER NOT NULL CHECK (proceeds_u > 0),
  cap_u         INTEGER NOT NULL,  early_cap_u INTEGER NOT NULL,  early_until INTEGER NOT NULL,
  daily_cap_u   INTEGER NOT NULL,
  spent_u       INTEGER NOT NULL DEFAULT 0,  reserved_u INTEGER NOT NULL DEFAULT 0 CHECK (reserved_u >= 0),
  inflight      INTEGER NOT NULL DEFAULT 0 CHECK (inflight >= 0),
  day TEXT NOT NULL DEFAULT '',  day_spent_u INTEGER NOT NULL DEFAULT 0,  day_requests INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  last_activity_at INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  CHECK (cap_u * 1055 <= proceeds_u * 500)
) WITHOUT ROWID;
CREATE INDEX periods_lineage ON periods(lineage_key);
CREATE INDEX periods_end ON periods(period_end);   -- lets cron and prune touch only live/old periods

CREATE TABLE reservations (
  payment_key TEXT NOT NULL,  req_id TEXT NOT NULL,
  reserved_u  INTEGER NOT NULL,  settled_u INTEGER,
  state       TEXT NOT NULL CHECK (state IN ('pending','held','settled','refunded','expired')),
  hold_token  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,  expires_at INTEGER NOT NULL,  settled_at INTEGER,
  PRIMARY KEY (payment_key, req_id)
) WITHOUT ROWID;

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
