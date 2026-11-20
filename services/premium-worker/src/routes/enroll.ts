// POST /v1/enroll (plan 6.1). Every cheap check runs before the first RevenueCat call, and the
// period is created before any device write so an identity conflict leaves no device row.
import { assertPeriodExists, preparePeriod } from '../billing/periods';
import { selectEnrollSubscription } from '../billing/subscription';
import type { Ctx } from '../context';
import { stmt } from '../db';
import { importBoundKey, verifyDeviceSignature } from '../identity/crypto';
import {
  countActiveDevices,
  getDevice,
  logged,
  readFields,
  tokenResponse,
} from '../identity/devices';
import { verifyNonce } from '../identity/nonce';
import { fromB64url } from '../identity/token';
import { ApiError } from '../http';
import { findLivePeriod } from '../ledger';
import { RevenueCatUnavailableError } from '../upstream/types';

const UPSERT = `INSERT INTO devices (rc_id, public_key, lineage_key, status, last_nonce_ts, verified_at, created_at)
VALUES (:rc, :pub, :lk, 'active', :ts, :now, :now)
ON CONFLICT(rc_id) DO UPDATE SET public_key = excluded.public_key, lineage_key = excluded.lineage_key,
  status = 'active', last_nonce_ts = excluded.last_nonce_ts, verified_at = excluded.verified_at
WHERE devices.last_nonce_ts < excluded.last_nonce_ts`;

// The count includes this device; MAX(0, ...) because SQLite reads a negative LIMIT as no limit.
const EVICT = `UPDATE devices SET status = 'revoked' WHERE rc_id IN (
  SELECT rc_id FROM devices WHERE lineage_key = :lk AND status = 'active' AND rc_id != :rc
  ORDER BY last_nonce_ts ASC, rc_id ASC
  LIMIT MAX(0, (SELECT COUNT(*) FROM devices WHERE lineage_key = :lk AND status = 'active') - :max))`;

export async function handleEnroll(request: Request, ctx: Ctx): Promise<Response> {
  return logged(ctx, '/v1/enroll', async (setLineage) => {
    const body = await readFields(request, ['rc_id', 'public_key', 'nonce', 'signature']);
    const db = ctx.env.DB;

    // 1. key and id
    const publicKey = fromB64url(body.public_key);
    const key = await importBoundKey(body.rc_id, publicKey);
    if (!key || !publicKey) throw new ApiError(400, 'id_key_mismatch');

    // 2. nonce, single use, signature
    const ts = await verifyNonce(ctx, body.nonce);
    if (ts === null) throw new ApiError(401, 'stale_nonce');
    const existing = await getDevice(db, body.rc_id);
    if (existing && existing.last_nonce_ts >= ts) throw new ApiError(401, 'stale_nonce');
    const signed = await verifyDeviceSignature({
      key,
      purpose: 'enroll',
      rcId: body.rc_id,
      nonce: body.nonce,
      signature: fromB64url(body.signature),
    });
    if (!signed) throw new ApiError(401, 'bad_signature');

    // 3. the subscription (first RevenueCat call)
    const now = ctx.deps.now();
    let prepared;
    try {
      const subs = await ctx.deps.revenuecat.listCustomerSubscriptions(body.rc_id);
      const sel = selectEnrollSubscription(subs, body.rc_id, ctx.config);
      if (!sel.ok) throw new ApiError(sel.status, sel.code);
      // 4. the covering transaction and the period, before any device write
      const txs = await ctx.deps.revenuecat.listTransactions(sel.sub.id);
      prepared = await preparePeriod(ctx, sel.sub, txs, now);
    } catch (e) {
      if (e instanceof RevenueCatUnavailableError)
        throw new ApiError(503, 'entitlement_unavailable');
      throw e;
    }
    setLineage(prepared.lineageKey);
    await prepared.statement.run();
    await assertPeriodExists(ctx, prepared.paymentKey, prepared.lineageKey);

    // 5. device upsert and LRU eviction in one batch
    const lk = prepared.lineageKey;
    const [upsert] = await db.batch([
      stmt(db, UPSERT, { rc: body.rc_id, pub: publicKey.buffer, lk, ts, now }),
      stmt(db, EVICT, { lk, rc: body.rc_id, max: ctx.config.limits.max_devices }),
    ]);
    // A concurrent replay of the same nonce changes nothing here and loses.
    const device = await getDevice(db, body.rc_id);
    if (
      !upsert ||
      upsert.meta.changes === 0 ||
      !device ||
      device.last_nonce_ts !== ts ||
      device.status !== 'active'
    ) {
      throw new ApiError(401, 'stale_nonce');
    }

    // 6. token
    const period = await findLivePeriod(db, body.rc_id, now);
    if (!period) throw new ApiError(403, 'subscription_required');
    return tokenResponse(ctx, body.rc_id, period, await countActiveDevices(db, lk), now);
  });
}
