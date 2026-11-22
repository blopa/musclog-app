import { it, expect } from 'vitest';
import * as H from './hot-path.mjs';

function burn(ms) { const t = performance.now(); let x = 0; while (performance.now() - t < ms && x < 5e8) x++; return x; }

it('timer behaviour inside workerd', async () => {
  const d0 = Date.now(), p0 = performance.now();
  let x = 0; for (let i = 0; i < 3e7; i++) x += i % 7; // pure CPU, no I/O
  const d1 = Date.now(), p1 = performance.now();
  console.log(`WORKERD_TIMERS cpu-loop(3e7 iters): Date.now delta=${d1 - d0}ms performance.now delta=${p1 - p0}ms (x=${x})`);
  await new Promise((r) => setTimeout(r, 50));
  const d2 = Date.now(), p2 = performance.now();
  console.log(`WORKERD_TIMERS after 50ms setTimeout (I/O boundary): Date.now delta=${d2 - d1} performance.now delta=${p2 - p1}`);
  // JSON.parse timing, if clocks advance only at I/O we see 0 here
  const body = H.makeBody(1e6);
  const a0 = performance.now(); for (let i = 0; i < 20; i++) JSON.parse(body); const a1 = performance.now();
  console.log(`WORKERD_TIMERS 20x JSON.parse(1MB jpeg body) sync: performance.now delta=${(a1 - a0).toFixed(3)}ms`);
  expect(true).toBe(true);
});

it('hot path inside workerd, wall-clock around await (includes I/O-boundary clock updates)', async () => {
  const rows = [];
  for (const [label, bytes] of [['100KB', 1e5], ['250KB', 2.5e5], ['500KB', 5e5], ['1MB', 1e6], ['2MB', 2e6]]) {
    const body = H.makeBody(bytes); const n = 30; const a = [];
    for (let i = 0; i < n; i++) { const s = performance.now(); JSON.stringify(H.allowlist(JSON.parse(body))); a.push(performance.now() - s); }
    a.sort((x, y) => x - y); rows.push(`${label}: p50=${a[n >> 1].toFixed(3)} max=${a[n - 1].toFixed(3)}`);
  }
  console.log('WORKERD_HOTPATH parse+allowlist+stringify (sync): ' + rows.join(' | '));
  const fx = await H.ecdsaFixture(); const s = performance.now(); for (let i = 0; i < 50; i++) await H.ecdsaVerify(fx);
  console.log(`WORKERD_HOTPATH ecdsa importKey+verify 50x total=${(performance.now() - s).toFixed(2)}ms`);
  const chunks = H.makeSseChunks(); const s2 = performance.now(); for (let i = 0; i < 50; i++) H.tailScan(chunks);
  console.log(`WORKERD_HOTPATH tailScan 50x total=${(performance.now() - s2).toFixed(2)}ms`);
  expect(H.tailScan(chunks).cost).toBe(0.00123);
});
