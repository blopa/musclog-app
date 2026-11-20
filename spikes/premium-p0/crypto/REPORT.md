# P0 spike A: device-key identity (plan 6.1) crypto interop and threat analysis

Run: `npm install && node make-vectors.mjs && npx vitest run` (29 tests, two vitest projects: `node` and `workerd`).
Versions: `@noble/curves` 2.4.0, `@noble/hashes` 2.4.0, vitest 4.1.12, `@cloudflare/vitest-plugin` 1.8.5 (the
`vitest-pool-workers` package is deprecated and renamed to this one), workerd 2026-08-15 (via wrangler 4.165.0).
Node v24.21.0. Note: npm blocked the workerd/esbuild postinstall scripts, but the workerd binary works anyway.

## 1. Interop result: it works, with three conditions

Client (noble) signs; the server (WebCrypto `importKey('raw')` + `verify({name:'ECDSA',hash:'SHA-256'})`, 64-byte P1363 signature)
verifies. Both in Node and inside **workerd** (the vector file was produced by the Node client and verified in workerd;
a second test signs and verifies fully inside workerd).

Conditions:

1. **noble prehash**: in 2.4.0 `p256.sign(msg, sk)` defaults to `prehash: true`, i.e. it signs `sha256(msg)`, which is exactly
   what WebCrypto ECDSA+SHA-256 verifies. Pass the raw UTF-8 message. If someone passes `prehash:false` on the raw message,
   WebCrypto rejects it (test "noble signs sha256(message) by default"). Signing `sha256(msg)` with `prehash:false` is
   equivalent to the default. Never hash by hand and leave prehash on (double hash).
2. **Signature format**: default `format:'compact'` is the 64-byte `r||s` that WebCrypto expects (no DER).
3. **Public key**: `getPublicKey(sk, false)` gives the 65-byte uncompressed point (`0x04||X||Y`), which is what both the
   rc_id hash and `importKey('raw')` use. Note `keygen().publicKey` is **compressed (33 bytes)** by default: do not hash that one.
   Compressed raw keys are rejected by the server's length check (`publicKey.length !== 65`).

Import path is `@noble/curves/nist.js` (extension required in v2); hashes from `@noble/hashes/sha2.js`.

## 2. Test results (all pass, in Node and workerd)

| Case | Outcome |
|---|---|
| Valid roundtrip | accepted |
| Wrong key (other keypair with its own matching rc_id) | 401 bad_signature |
| Tampered rc_id (1 char) / rc_id of a different key | 400 rc_id_mismatch (checked before the signature) |
| Tampered nonce | 401 |
| Tampered body (hash covers it) | 401 |
| Signature for `enroll` replayed as `session` | 401 (purpose is inside the signed string), and 400 if the endpoint expectation differs |
| Truncated key, off-curve key, all-zero point | 400 (`importKey` throws for off-curve in workerd and Node) |
| Wrong signature length / all-zero signature | 400 / 401 |
| **High-S** signature | **WebCrypto accepts it** (Node and workerd). noble `verify` rejects high-S by default, `lowS:false` accepts. noble `sign` is low-S by default (0 of 60 high-S; 25 of 60 high-S with `lowS:false`). |

Consequences of high-S acceptance: every valid signature has a second valid encoding `(r, n-s)`. So **never use the signature
bytes as a replay key or dedupe key**; consume the *nonce*. If you want canonical signatures, the Worker can check
`s <= n/2` itself (cheap, 32-byte compare) before `verify`. Not required if the nonce is single use.

What these tests do NOT prove: nonce freshness and single use are server state (D1/KV) and are not in this spike. A
signature has no timestamp; it is only as fresh as the nonce it covers. If nonces are client-chosen or stateless
(`HMAC(time)`), enroll and session signatures are replayable within the window.

Also: the signed string has no audience (host, method, path). `purpose` covers enroll vs session, but add the endpoint path
(or a version-bound audience string) if more endpoints ever sign.

## 3. Timing (Node 24, one Linux desktop, p50 / p99 ms)

| Operation | p50 | p99 |
|---|---|---|
| noble keygen + pubkey + rc_id | 0.52 | 0.91 |
| noble sign | 0.30 | 0.51 |
| noble verify (not used server side) | 1.29 | 2.70 |
| WebCrypto verify (Node) | 0.09 | 0.23 |

**Hermes numbers are unknown; I did not measure on a device and found no source I can cite.** Expect it to be noticeably
slower than V8 JIT (Hermes is an interpreter without JIT, and noble's P-256 uses `BigInt`), possibly 1-2 orders of magnitude,
i.e. tens to hundreds of ms per sign. That is acceptable for once-per-session signing but must be measured on a mid-range
Android before G-gates close. Open: confirm `BigInt` is available in the project's Hermes build (SDK 58 default) and that
`crypto.getRandomValues` exists for noble's `randomBytes` (the repo already has `react-native-get-random-values` and
`expo-crypto`; or pass `getRandomBytes(32)` as the `seed` to `keygen`/`randomSecretKey`).

## 4. Read-only check of the app repo

- `expo-crypto` **is installed**: `package.json:201` `"expo-crypto": "~58.0.8"` (installed 58.0.8). `node_modules/expo-crypto/build/Crypto.d.ts`
  exports `getRandomBytes` (line 13), `getRandomBytesAsync` (20), `digestStringAsync` (41), `digest(algorithm, BufferSource)`
  (84, SHA-256 via `CryptoDigestAlgorithm`), `randomUUID` (67). Hashing the 65-byte key can use `digest` or `@noble/hashes`.
- `expo-secure-store` 58.0.3 is installed (`package.json:220`). `node_modules/expo-secure-store/build/SecureStore.d.ts`:
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY` exported at line 39; `SecureStoreOptions.keychainAccessible` at line 86
  (`@default SecureStore.WHEN_UNLOCKED`, `@platform ios` only). **The default migrates to a new device through an encrypted
  backup, so the plan must pass `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (or `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`) explicitly.**
  `keychainAccessible` has no effect on Android.
- **Size limits**: the type file states none. Historically iOS warned above ~2048 bytes per value; a 32-byte key
  (64 hex chars) is far below any such limit. Not verified against the native source.
- `@noble/curves` is **not** in the app's `node_modules`/`package.json` (only transitive `@noble/hashes` 1.8.0 and
  `@noble/ciphers` 1.3.0). Adding it also brings `@noble/hashes` 2.x import paths (`sha2.js`); check for duplicates.
- Android backup: `android/app/src/main/AndroidManifest.xml:62` has `allowBackup="true"` with
  `fullBackupContent=@xml/secure_store_backup_rules` and `dataExtractionRules=@xml/secure_store_data_extraction_rules`. The library
  ships these (`node_modules/expo-secure-store/android/src/main/res/xml/secure_store_backup_rules.xml` excludes
  `sharedpref/SecureStore`), so the key is **excluded from Android Auto Backup and device transfer**. I read only the
  full-backup file; the data-extraction file (Android 12+) was not read: verify it the same way.
- Caveat: SecureStore holds the key as bytes that the JS code reads into Hermes memory to sign. It is "non-exportable" only at rest.
  A hardware-bound, non-extractable signing key (Android Keystore / iOS Secure Enclave, P-256) needs a native module
  that this repo does not have. That is the stronger design if key theft ever matters; the plan accepts the tradeoff.

## 5. Threat analysis of plan 6.1

Legend: STOPS = design prevents it. BOUNDED = it can happen, damage limited as stated. OPEN = depends on RevenueCat/store
behaviour I did not verify; it must be checked in docs or sandbox. I assume nothing about RevenueCat internals.

| # | Attack | Verdict | What bounds it / what remains |
|---|---|---|---|
| 1 | **Stolen `rc_id`** (it is not secret: it appears in RevenueCat, in our logs, in Sentry) | STOPS for our server, if all server paths follow the rules | The ID alone proves nothing: enroll/session need a signature by the key whose SHA-256 is the ID (tested: tampered or foreign IDs are rejected before verify). Rule: **never** accept a request on `rc_id` alone, never issue a token from an ID without a fresh signature, never log it as a credential. A mismatched ID is only safe because the Worker recomputes the hash itself. |
| 2 | **Stolen session token** (1 h HMAC bearer) | BOUNDED | Valid up to `exp` (1 h) for that device only; spends only that period's budget (inflight/daily caps). Revocation: device `status` is checked per request in the reservation SQL (plan 8.2), so revoking the device kills the token early. Keep tokens out of logs/Sentry; keep `exp` short. A rotation path for the HMAC secret must exist. |
| 3 | **Replayed enroll** (or session) request | STOPS only with a single-use server-issued nonce | The signature itself has no clock. With a nonce row consumed atomically (D1 `DELETE ... RETURNING`) a replay is rejected; without it, a captured enroll is replayable (idempotent per key, so low impact, but a replayed *session* request mints tokens). Dedupe on the **nonce**, not the signature (high-S gives a second valid signature). Nonce TTL must be short and nonces rate-limited (unauthenticated nonce minting is a D1 write amplification vector on the free tier). Not tested here: server state. |
| 4 | **Attacker knows `rc_id`, uses RevenueCat's public SDK key** to call logIn/restore/attributes as that user | OPEN, partly BOUNDED | The public SDK key is by design in every app binary, so anyone can call the RC client API for any app user ID. What an attacker can do to a *victim's* RC customer is not established. Questions to verify in RC docs/sandbox: (a) can they post **their own** receipt under the victim's ID, so the victim's customer carries someone else's subscription (our `gives_access` read then reflects a payment the victim did not make, and the attacker could cause the victim's lineage/payment_key to confuse or block their enroll via the 409 `transfer_not_confirmed` rule)? (b) can they set subscriber attributes on the victim, and does anything we read depend on attributes (it must not)? (c) does `logIn`/alias creation on a known ID change which ID holds a subscription? (d) rate limits on the public API. Mitigation by design: the Worker trusts only the REST v2 secret-key view of the *store-verified* subscription and takes `payment_key`/`lineage_key` from the store transaction, not from the RC customer. Add a rule: if the customer has more than one subscription, fail closed (503) rather than guess. |
| 5 | **Leaked store purchase token / receipt** posted to RevenueCat under an attacker-chosen ID | NOT STOPPED by the design; BOUNDED | A receipt/token is a bearer proof of the payment (Google purchase tokens especially). The attacker generates a fresh keypair, restores the receipt under their new `rc_id`, RC transfers access (setting "Transfer to new App User ID"), the Worker then sees old access gone and enrolls the attacker, revoking the victim ("Premium moved"). The victim notices and restores back; the same `payment_key` means one shared budget, never two. Damage = at most one period budget per payment, and a one-active-device ping-pong. OPEN: whether RC/Apple/Google require anything beyond the token to restore (account binding, fraud protection), and how likely tokens are to leak (they live in RC, in the app's SDK memory, and on device logs only). |
| 6 | **Device key extraction via backup** | BOUNDED, platform-specific | Android: SecureStore prefs are excluded from Auto Backup (cited above; Android 12+ data-extraction file unverified). iOS: **default `WHEN_UNLOCKED` migrates through encrypted iTunes/iCloud-device backups and restores to another phone, creating a cloned key and a second active device claim.** Fix: set `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` at creation. Trade: restoring an iPhone onto a *new* phone loses the key (user does Restore, as the plan already says). Any on-device compromise (jailbreak/root/malware reading JS memory) still yields the key; bounded by one period budget. |
| 7 | **RevenueCat "restore behaviour" project setting changed** | OPEN (fail-closed if checked) | Plan relies on "Transfer to new App User ID". Other values ("Transfer if there are no active subscriptions", "Keep with original app user ID") would leave the old ID with access, so rule 3.5 fails closed (409 forever) rather than granting. That is safe but breaks restores; it is a dashboard setting that an operator or a Terraform drift can change silently. Verify the setting names/semantics and test each value in sandbox; add a startup/cron self-check if RC exposes it by API (unverified). |
| 8 | **Promotional / RC-granted entitlements** | OPEN | RC lets anyone with dashboard or secret-key access grant promotional entitlements; client cannot. The plan excludes them by requiring a store subscription with store revenue. Verify the exact v2 fields that distinguish promotional from store grants, and that a store subscription whose entitlement was *also* promotionally extended is not mis-classified. The RC secret key is the crown jewel: it must be a Worker secret, never in the app. |
| 9 | **Key farming / free minting** | BOUNDED | Any rooted device can mint unlimited keypairs and rc_ids at zero cost. Each still needs a paid store subscription at enroll (step 3.3), so there is no free budget. The cost is Worker/RevenueCat API calls per bogus enroll (RC rate limits, D1 writes). Needs IP/ASN rate limiting in the Worker and fail-fast before any RC call when the signature or ID check fails (as ordered in the plan). |
| 10 | **Family Sharing / same Apple ID on two phones** | OPEN | Both phones restore the same store subscription; RC transfers each time; the plan's one-active-device rule makes them ping-pong. Bounded by one budget (payment-keyed). Needs sandbox check that the transfer is observable by the old ID within the Worker's re-query window (RC eventual consistency). |

### Overall assessment

The plan's claim "a stolen rc_id gives an attacker nothing" is **true for our Worker** provided the Worker never trusts an ID
without a signature and uses a single-use server nonce. It is **not true for the RevenueCat side** (rows 4, 5, 7, 8), where
the public SDK key lets anyone act on a known app user ID and a leaked receipt moves a subscription. The design is safe only
because the Worker (a) derives budgets from the store transaction, (b) fails closed on ambiguity, and (c) caps damage at one
period budget per payment. Those three properties, not the key scheme, carry the security, and they are all dependent on
RevenueCat behaviour that must be proven in sandbox (gate G2).

Concrete additions suggested: single-use server nonces with TTL and rate limits; check `s <= n/2` or dedupe on nonce; include
the endpoint path in the signed string; set `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; fail closed on multiple subscriptions in one RC
customer; measure noble on Hermes (Android mid-range) before committing to `@noble/curves`.

## 6. Open items (must be verified, not assumed)

- Hermes timing of keygen/sign on a real mid-range phone; `BigInt` and `getRandomValues` availability.
- Android 12+ `secure_store_data_extraction_rules.xml` content.
- RevenueCat: behaviour of public-SDK-key calls on an arbitrary known app user ID (rows 4, 5); restore-behaviour setting values
  (row 7); promotional vs store entitlement fields in v2 (row 8); consistency delay after a transfer (row 10).
- SecureStore value size limits on iOS/Android (none documented in the installed types).
