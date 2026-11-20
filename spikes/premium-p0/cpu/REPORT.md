# P0 spike B: Worker hot-path CPU proxy

Run: `npm install && node bench-node.mjs` (Node v24.21.0) and `npx vitest run --disableConsoleIntercept` (runs `workerd.spec.mjs`
inside workerd 2026-08-15 through `@cloudflare/vitest-plugin`). Raw Node output: `bench-node.out`. The hot-path code is
`hot-path.mjs` (same file in both runtimes).

Sizes are the **JPEG bytes**; the JSON body is about 4/3 larger (base64): 100 KB = 0.13 MB body, 250 KB = 0.33, 500 KB = 0.67,
1 MB = 1.33, 2 MB = 2.67. Body = OpenAI chat-completions with a text part, one `data:image/jpeg;base64,` image, a JSON-schema
`response_format` and two junk fields the allowlist drops. 60 iterations per cell, one desktop CPU, single process, GC included
(so p99 is noisy).

## Node results (ms, p50 / p99)

| JPEG | JSON.parse | allowlist rebuild | JSON.stringify | parse+allowlist+stringify |
|---|---|---|---|---|
| 100 KB | 0.06 / 0.47 | 0.001 / 0.27 | 0.11 / 0.49 | 0.22 / 0.87 |
| 250 KB | 0.15 / 0.62 | 0.001 / 0.03 | 0.36 / 1.12 | 0.54 / 2.18 |
| 500 KB | 0.31 / 1.36 | 0.001 / 0.03 | 0.74 / 1.72 | 1.02 / 1.96 |
| 1 MB | 0.57 / 2.32 | 0.001 / 0.03 | 1.41 / 2.85 | 1.97 / 4.39 |
| 2 MB | 1.20 / 5.10 | 0.001 / 0.03 | 2.74 / 5.38 | 3.81 / 6.53 |

Other pieces (p50 / p99): HMAC-SHA256 token verify 0.009 / 0.15; ECDSA P-256 `importKey` + `verify` 0.13 / 0.41;
SSE tail scan (2,000 chunks, keep last 2 KB, find the final `usage` object, `JSON.parse` it) 0.06 / 0.20.
The allowlist is ~free because string values (the big base64) are copied by reference; it only walks the structure.
Stringify is the most expensive step (it must scan the 1 to 2.7 MB string for escapes), more than parse.

## workerd observations

- Same code ran in workerd (tests pass; the tail scan returned the right `usage.cost`).
- **Timers were NOT frozen in this test runtime.** A pure CPU loop (3e7 iterations, no I/O) showed `Date.now` and
  `performance.now` advancing 32 ms, both at whole-millisecond resolution; after `setTimeout(50)` they advanced 51. Twenty
  synchronous parses of the 1.33 MB body measured 7 ms (0.35 ms each, consistent with Node).
- Cloudflare documents that **in production** `Date.now()`/`performance.now()` only advance at I/O boundaries (a Spectre
  mitigation), so a pure-CPU measurement inside a deployed Worker would read 0. I could not confirm this (no account, no deploy,
  and I did not fetch the docs), and the local runtime evidently does not apply it. Do not trust local-workerd timings as proof of the
  production number; they only show it is the same V8 engine at similar speed. The reliable production measure is the
  `cpuTime` field in Workers Logs / `wrangler tail` for a deployed canary (P1).
- The ECDSA verify in workerd took 2 ms for 50 verifies (clock resolution 1 ms, so only an upper bound of ~0.04 ms each).

## Conclusion (Node is only a proxy)

Workers Free has a 10 ms CPU limit per request (from the plan/Cloudflare documentation, not re-verified here). Total request
CPU is the body path plus token verify (~0.01 ms), at most one ECDSA verify (~0.15 ms), D1 calls (little JS CPU),
the response stream handling, and Worker startup.

- **Comfortable: images up to ~500 KB JPEG (0.67 MB body)**: about 1 ms p50 and 2 ms p99 for the body path, leaving
  more than 5x headroom for everything else.
- **Marginal: 1 MB JPEG (1.33 MB body)**: 2 ms p50, 4.4 ms p99 in Node. Probably fits, but the margin vanishes if workerd on shared
  hardware is 1.5 to 2x slower than this desktop, and the tail (GC) is real. Treat as not safe on Free without a production
  canary.
- **Not safe: 2 MB JPEG** (3.8 ms p50, 6.5 ms p99 before any other work).

So the app-side resize in plan section 11 item 4 should target **at most ~300 to 500 KB JPEG** (the plan's G6 image budget
decides the token side; this is the CPU side). Avoiding the full parse is possible (verify a small JSON header and pass the
body through) but conflicts with the allowlist requirement, so cap size instead.

Not measured: the streaming response path (a JS `TransformStream` doing the tail scan per chunk adds per-chunk overhead on top
of the 0.06 ms scan; a native pass-through with a `tee` of only the last 2 KB is cheaper), TLS/subrequest CPU, D1 binding
overhead, Worker cold start. Request-body size limits of the Free plan (and the 128 MB memory bound: a 2.7 MB string parsed
and rebuilt is a few times its size) were not checked.
