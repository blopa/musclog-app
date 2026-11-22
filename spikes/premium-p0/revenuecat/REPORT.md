# P0 desk research: RevenueCat identity, store fees, proceeds (G2, G7, G9)

Read 2026-11-20. No account, credential or purchase used. Saved by the orchestrator from the research worker's report (condensed; the worker could not write files). VERIFIED = quoted from the official page; NOT DOCUMENTED = looked for, not stated.

## RevenueCat

- **logIn** (docs/customers/identifying-customers, VERIFIED): identified → any id: "No merge or purchase transfer occurs." Anonymous → new id or id without anonymous alias: "CustomerInfo merged." So identified ids never merge via logIn.
- **Restore** (docs/projects/restore-behavior, VERIFIED): default "Transfer to new App User ID", "only one customer at a time can have access ... revoked from UserA"; also applies to a new purchase on a receipt owned by another identified id; anonymous owners are **aliased, not transferred** (so the first purchase must happen under the key-derived id, never anonymously). A separate sandbox restore behavior can be configured: it must match production. Revocation timing: NOT DOCUMENTED. `syncPurchases` uses the same path.
- **TRANSFER webhook**: sent for the destination user; history also readable via `GET /v2/projects/{p}/customers/{c}/events`.
- **Restore proof sent by the SDK** (receipt / signed transaction / purchase token): NOT DOCUMENTED. Clients see `store_transaction_id` (v1 JSON) and `transactionIdentifier` (RN SDK): treat as non-secret. Purchase token and Apple original transaction id: not named in any client-facing doc read.
- **API v2** (VERIFIED, permissions per endpoint):
  - `GET /projects/{p}/customers/{c}/subscriptions`, `GET /projects/{p}/subscriptions/{sub}`, `GET .../subscriptions/{sub}/transactions`, and search `GET /projects/{p}/subscriptions?store_subscription_identifier=<any past or current Apple transactionId or Play order id>` → `customer_information:subscriptions:read`. Customer and active entitlements → `customer_information:customers:read`. Write actions (transfer, grant_entitlement, restore_purchase_by_order_id, refund) need `read_write`: the Worker key must not have them.
  - Rate limit: Customer Information 480 requests/min per key.
  - `SubscriptionTransaction.id` = "The ID of the subscription transaction in the store" (store id, stable). `revenue_in_usd` may be null; `gross` excl. taxes and commission, `commission`, `tax` ("Estimated"), `proceeds` ("Net revenue after store commission / fees and taxes"). No `store`, original-transaction or lineage field. Timing after purchase: NOT DOCUMENTED (G9).
  - `Subscription`: `id` (RC-generated; stability across transfer NOT DOCUMENTED), `customer_id`, `original_customer_id`, `gives_access`, `status`, `store` (… `promotional`, `test_store` …), `environment`, `ownership`, `product_id` (null for promotional). `store_subscription_identifier` = latest Apple transaction id / latest Play order id, so **Apple's original transaction id is not exposed by v2**.
- **Sandbox speeds**: Apple monthly renews every 5 min (max 12/day; TestFlight renews daily); Google monthly every 5 min (max 6 renewals). Test Store: Worker logic only, not G2; must be rejected in production.
- **Webhooks**: "Pro" is the single current plan, free below $2.5K MTR; webhooks are listed under "Everything's Included". Not required by the design.
- **Fee**: "MTR ... in USD, before the platform cut"; 1% of all MTR once $2.5K is reached ("For $2.5K, we'll charge you $25"); VAT-inclusive or not: NOT DOCUMENTED. Not inside `proceeds`.
- **Promotional / offer codes**: `grant_entitlement` creates `store=promotional`, `product_id` null. Offer-code representation in v2: NOT DOCUMENTED (likely app_store with 0/null revenue → cap 0).

## Stores

- **Apple** (Schedule 2 v127, 2026-10-13): commission 30%, 15% for renewals after one year of paid service; Small Business Program 15% (≤ $1M prior-year proceeds, Exhibit B regions, needs enrolment). Prices are "net of any and all taxes collected"; Apple remits VAT in Exhibit B regions (EU states included). Bank FX differentials may be deducted. Refunds at "Apple's sole discretion", the developer reimburses the full price. **Family Sharing cannot be turned off once on.** Guidelines: 3.1.1 restore mechanism required; **3.1.2(a) "Subscriptions must work on all of the user's devices where the app is available"**; 3.1.2(c) clear description, price, duration, Terms and Privacy links; 5.1.2(i) explicit consent before sharing with third-party AI.
- **Google Play**: from 2026-06-30, 10% service fee + 5% billing fee (US/UK/EEA) = 15% for subscriptions; 15% elsewhere. Google remits EU VAT (fee on the net price). Refund window for subscriptions: NOT DOCUMENTED. RTDN not mandatory, "strongly recommended" for price accuracy. Policy: easy online cancellation; terms must reserve price increases with ≥ 30 days notice.
- **VAT**: EU minimum standard rate 15% (EC page); 17%–27% range to confirm in TEDB.

## Identity attacks (per docs)

Impossible if controls hold: logIn(victim) moving purchases (A1), restore moving anything but the attacker's own store purchases (A2), Worker key misuse (read-only scopes, A9), promotional grants counted as paid (A10), Family Sharing (off, A11).
Possible / bounded: control of the victim's store account (A3, by design; bounded by device limit and payment-keyed budget); spam customers via public `GET /v1/subscribers/{id}` (A5, no billing effect); attribute writes with the public key (A6, never trusted); **anonymous first purchase aliases instead of transferring (A7: never configure RevenueCat anonymously)**; old id keeps access for an unknown time after transfer (A13); sandbox restore behavior differing (A15).
Needs a G2 test: whether a known transaction id alone can restore (A4); public-key probes for exposed tokens (A17).

## G2 test matrix (summary)

Setup: two sandbox accounts and two devices per store; v2 key with only the two `:read` permissions; restore behavior "Transfer to new App User ID" in production and sandbox; monthly product. Record per step: customer_id, original_customer_id, subscription.id, store, environment, ownership, status, gives_access, store_subscription_identifier, and per transaction id, purchased_at, expiration_date, effective_expiration_date, revenue_in_usd, wall-clock time.
Apple: 1 purchase (time to non-null proceeds, G9) · 2 three renewals · 3 reinstall + Restore under a new key-derived id (and `syncPurchases`) · 4 transfer to device 2 and back, search by a past id returns the current owner · 5 cancel and resubscribe · 6 billing grace/retry · 7 refund · 8 cache invalidation. Play: 9–15 the same (order-id root rule, declining test card, refund from Play Console). Traps: 16 anonymous purchase then logIn · 17 public-key probes · 18 promotional grant, Apple offer code, Play promo code · 19 Test Store build · 20 "Transfer if no active subscriptions" variant.

## Conservative fee assumptions where docs are silent

Apple commission 30% until Small Business Program enrolment is confirmed (Play 15%); VAT up to 27%; RC 1% of the tax-inclusive price (cliff assumed in force); FX haircut ≥ 2%; refunded period: whole proceeds lost, spend unrecoverable. Fallback floor: €4.99 / 1.27 × 0.70 − 1% × 4.99, × 0.98 ≈ **€2.65** net.

## Maintainer checks (dashboards)

RC: restore behavior (prod and sandbox), server-to-server "track new purchases" off, v2 read-only key, public-key `GET /v1/subscribers` output, MTR VAT basis. Apple: Small Business Program enrolment, Family Sharing off, no offer codes, agreements/tax/banking. Play: fee tier, merchant-of-record settings, RTDN, license testers, decline test card, refund window, full policy text. EU VAT table (TEDB). App Review of 3.1.2(a) wording and the 5.1.2(i) consent. Apple refund window.
