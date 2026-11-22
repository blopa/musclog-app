# P0 spike: D1 budget ledger (plan 8.2 / 9), corrected design, revision 2 of the spike

Verdict: the corrected reserve and settle batches are atomic and exactly-once in every test (Miniflare 4.20260730, local D1 on workerd). The financial invariant held in all cases. At the plan's mix the free tier fits with large margin; the worst case (60 req/day for 1,500 subscribers) does NOT fit on writes, and the new `daily_full` flag is what keeps it inside the limit.

## How to run

```
npm --prefix spikes/premium-p0/ledger install
npm --prefix spikes/premium-p0/ledger test      # vitest, offline, about 80 s (each Miniflare D1 call is ~100 ms)
```

Files: `schema.sql` (plan 9 tables; `pending` state added, `settle_token` dropped, no clamps, plus `periods_end` index on `period_end`), `ledger.ts` (the SQL and wrappers), `harness.ts`, `ledger.test.ts`, `cost.json` (written by test 8, source of every cost number here).

## Changes in this revision

1. Sweep statements are guarded by `state='held' AND expires_at < :now` and charge the row's own `reserved_u` through a subselect (no `:a`): `SWEEP_PERIOD`, `SWEEP_RES`, `sweepStatements`. The earlier flaw (a stale sweep expiring a re-admitted refunded hold) is now a passing test.
2. `isAdmitted(row, hold)` in `ledger.ts`: admitted only when `hold_token = :hold AND state = 'held'`; used by `reserve`.
3. Global daily admission flag: the reserve INSERT and the refund re-admission guard require `COALESCE(meta.daily_full,'0') = '0'`. `updateDailyFull(now, day, globalMax)` is one statement that sums today's `day_requests` over periods with `period_end > now - 1 day` and upserts `daily_full`, writing only when the value changes. Refused reserves (`daily_full`) do zero writes (tested: tables are byte-identical afterwards and every statement reports `rows_written = 0`). The next day's run reopens admission.
4. Sweep and global cron scans are restricted to `period_end > now - 1 day` through the new `periods_end` index. Prune: reservations settled more than 7 days ago, periods ended more than 60 days ago.

## Results (20 tests, all pass)

| #   | Test                                                                                                                                                                                                                                                                                                                                                                                 | Result           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| 1   | Revision-2 bug reproduced. Two requests in flight (r=100 each), settle a=60 once: `spent 60, reserved 100, inflight 1`. Replay of the old batch: `spent 120` (double charge), `reserved 0` (the other request's hold silently released by the MAX(0) clamp), `inflight 0`, `day_requests 2`.                                                                                         | PASS (bug shown) |
| 2   | Reserve batch replayed 5x after commit: period row byte-identical. Settle batch run 6x: charged once. Reserve replay after settle does not resurrect the hold (outcome `already_processed`).                                                                                                                                                                                         | PASS             |
| 3   | 100 concurrent reserves (r=100, cap 3750): exactly 37 admitted, 63 `budget_exhausted`, `spent+reserved = 3700`. 37 concurrent settles with varied amounts: reserved 0, inflight 0, spent exact. `max_inflight=2`: 2 of 20 admitted, 18 `busy`.                                                                                                                                       | PASS             |
| 4   | Same req_id, other token: `in_progress` while held; `already_processed` after settled or expired; refunded re-admitted once (10 concurrent re-admits admit exactly 1, replaying the re-admit batch is a no-op). Refund charges 0.                                                                                                                                                    | PASS             |
| 5   | Crash then sweep charges `reserved_u` once; late settle and second sweep are no-ops. Sweep racing 20 settles: each reservation charged once, `spent_u` = sum of `settled_u`. Sweep ignores recent activity and unexpired holds. Stale sweep leaves a re-admitted refunded hold untouched. Sweep batch replayed 4x charges the row's own `reserved_u` once. `isAdmitted` truth table. | PASS             |
| 5b  | `daily_full`: below `globalMax` reserves are admitted and the cron writes nothing when unchanged; at `globalMax` the flag flips, 10 concurrent reserves are all refused with zero writes and unchanged tables; next day the cron reopens admission.                                                                                                                                  | PASS             |
| 6   | Overrun (a=450, r=100) charged in full, once over 3 attempts.                                                                                                                                                                                                                                                                                                                        | PASS             |
| 7   | `reserved_u < 0` and `inflight < 0` CHECKs fire and roll back the whole settle batch; the financial CHECK rejects a doubled cap and rolls back the earlier statement.                                                                                                                                                                                                                | PASS             |
| 8   | Cost measurement, below.                                                                                                                                                                                                                                                                                                                                                             | PASS             |

## Cost (D1 result `meta.rows_written` / `rows_read`, as exposed by Miniflare)

| Operation                                                         | rows written                                                                                                     | rows read                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Reserve batch (3 statements)                                      | 3                                                                                                                | 8                                                             |
| Read-back of the reservation row                                  | 0                                                                                                                | 1                                                             |
| Settle batch (2 statements)                                       | 2                                                                                                                | 5                                                             |
| Reserve refused (budget, or `daily_full`) incl. diagnose          | 0                                                                                                                | 3 to 4                                                        |
| Period creation (row + `periods_lineage` + `periods_end` indexes) | 3                                                                                                                | 0                                                             |
| Device insert (incl. unique partial index)                        | 3                                                                                                                | 0                                                             |
| Prune reservations, per deleted row                               | 1                                                                                                                | about 2: it scans the whole table (4,001 read for 4,000 rows) |
| Prune periods, per deleted row (row + 2 indexes)                  | 3 per row measured as `rows_written` 1 per row in Miniflare's meta (1,500 for 1,500); budget 3 as for the insert | 1 per deleted row (1,501 read)                                |
| Prune reservations on an empty table                              | 0                                                                                                                | 1                                                             |

Cron reads per run (one run = sweep scan + `updateDailyFull`; both read the live periods through `periods_end`):

| Periods in table                   | live (in window) | sweep reads | `daily_full` reads | reads per run               |
| ---------------------------------- | ---------------- | ----------- | ------------------ | --------------------------- |
| 1,500                              | 1,500            | 1,500       | 1,500              | 3,000                       |
| 3,000 (1,500 live + 1,500 history) | 1,500            | 1,500       | 1,501              | 3,001 (history is not read) |
| 3,000                              | 3,000            | 3,000       | 3,001              | 6,001                       |

History no longer costs reads (the old design read 21k rows per sweep). `daily_full` writes: 2 on the first insert, then 0 when unchanged (2 per flip). Sweep writes only when it finds stale holds.

Per request: **6 rows written** (reserve 3 + settle 2 + prune 1) and about **22 rows read** (reserve 8 + read-back 1 + settle 5 = 14, plus the prune scan: the daily prune reads the whole reservation table, which holds about 8 days of rows, so each row is scanned about 8 times). Per paid period: 3 writes to create and 3 to prune (both about 6 per subscriber per month = 0.2/day).

Size, measured by `size_after` growth (page granular): about **121 B per reservation row** (4,000 rows) and about **336 B per period row including both secondary indexes** (1,500 rows). Plan on 150 B and 350 B.

## Projection against D1 Free (100,000 rows written/day, 5,000,000 rows read/day, 500 MB)

Mix at 1,500 subscribers: 0.70x1500x2 + 0.25x1500x5 + 0.05x1500x30 = 2,100 + 1,875 + 2,250 = **6,225 requests/day**. Cron at a 15-minute interval = 96 runs/day.

|                         | Mix, 1,500 subs                                                                                        | Mix with 3,000 live period rows | Worst case 60 req/day x 1,500 = 90,000 req/day, no global stop |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------- | -------------------------------------------------------------- |
| Rows written/day        | 6,225 x 6 + 1,500 x 0.2 = **about 37.7k (38%)**                                                        | same                            | 540k (5.4x, FAILS)                                             |
| Rows read/day, requests | 6,225 x 22 = 137k                                                                                      | 137k                            | 1.98M                                                          |
| Rows read/day, cron     | 96 x 3,000 = 288k                                                                                      | 96 x 6,001 = 576k               | 288k                                                           |
| Rows read/day, total    | **about 425k (8.5%)**                                                                                  | about 713k (14%)                | about 2.3M                                                     |
| Storage                 | 6,225 x 8 days x 150 B = 7.5 MB + 3,000 periods (60-day retention) x 350 B = 1 MB, **about 9 MB (2%)** | about 10 MB                     | about 109 MB                                                   |

Writes are the binding quota. **Maximum requests/day with 40% headroom (60% of each limit):**

- writes: (60,000 - 300) / 6 = **9,950 requests/day** (full limit would be 16,600).
- reads: (3,000,000 - 288,000) / 22 = about 123,000, not binding.
- So `globalMax` for `updateDailyFull` should be at most about **9,900 settled requests/day** (about 6.6 requests per subscriber per day averaged over 1,500; the mix averages 4.15). With the flag set at that value the 60 req/day worst case is stopped by the global flag instead of exhausting the DB: the first about 165 subscribers using 60 req/day, or any combination, consume it, the rest get `daily_full`.
- Overshoot: the flag is updated each cron run (15 min) and counts SETTLED requests only, so admissions can exceed `globalMax` by whatever arrives within one interval plus in-flight holds. At 9,900/day that is about 100 requests on average per interval, but a burst can be several times that; the 40% headroom covers it. A 5-minute cron on this path would cost about 3x the cron reads (still under 1M/day).

## Flaws and caveats

Fixed in this revision: the sweep/re-admission race (flaw 1 earlier), and the read-back admitting by token only.

Remaining:

1. **`daily_full` is a global kill switch.** One abuser consuming `globalMax` shuts out everyone until the next day. Per-subscriber `max_requests_per_day` and `daily_cap_u` bound this to (globalMax / per-subscriber max) subscribers acting together; size it accordingly. The flag also works on settled counts, so `day_requests` includes refunded requests (they count, as in the settle SQL).
2. **Refused requests are not free**: 3 to 4 reads each and no writes. Rate-limit upstream: 1M refused requests/day would exhaust the 5M read limit.
3. **Prune of reservations is still a full scan** (about 8 of the 22 reads per request). Acceptable (137k reads/day at the mix); per-period PK-prefix pruning would be cheaper if reads ever matter.
4. A refunded request still increments `day_requests`; arguably desired for abuse control.
5. An overrun can push `spent_u` past `cap_u` (intended; the next reserve is refused).
6. Settling a reservation whose period row was pruned settles the reservation with no period charge; unreachable with 60-day period vs 7-day reservation retention.
7. The sweep's `:day` is the cron's day, so a swept hold is attributed to the day the sweep ran (settle semantics are the same for late settles).

## Miniflare vs production D1 (all unverified against production)

- `rows_read` and `rows_written` are Miniflare's counts. Production billing counts index writes and may count index scans differently (for example an index range read plus the table lookup may count as 2 per row; the sweep/flag figures above would double). The prune-periods write count shows 1 per row in Miniflare although 3 b-trees change; production may report 3. Verify all of this on a real database (a gate, not done here).
- Batch atomicity (all-or-nothing rollback) is verified on Miniflare only.
- Concurrency here is `Promise.all` from one Node client serialized by SQLite's single writer; production concurrency across many isolates and colos is also serialized at the primary but not exercised. Read replicas (Sessions API) are assumed off; with replicas the post-batch read-back must hit the primary.
- Latency (about 100 ms per call here) is not representative.
- Production limits (100 bound parameters per query, statements per batch, 30 s query time) were not exercised; the longest batch here is 3 statements.
- `size_after` is page-granular, so bytes per row are approximate.
