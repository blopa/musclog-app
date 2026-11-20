import * as H from './hot-path.mjs';
const sizes = { '100KB': 1e5, '250KB': 2.5e5, '500KB': 5e5, '1MB': 1e6, '2MB': 2e6 };
const pct = (a, p) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
const fmt = (a) => `${pct(a, .5).toFixed(3)} / ${pct(a, .99).toFixed(3)}`;
async function time(n, f) { const a = []; for (let i = 0; i < n; i++) { const s = performance.now(); await f(); a.push(performance.now() - s); } return a; }
const rows = [];
for (const [label, bytes] of Object.entries(sizes)) {
  const body = H.makeBody(bytes); const n = 60;
  const parse = await time(n, () => JSON.parse(body));
  const parsed = JSON.parse(body);
  const allow = await time(n, () => H.allowlist(parsed));
  const out = H.allowlist(parsed);
  const str = await time(n, () => JSON.stringify(out));
  const all = await time(n, () => JSON.stringify(H.allowlist(JSON.parse(body))));
  rows.push({ label, jsonMB: (body.length / 1e6).toFixed(2), parse: fmt(parse), allow: fmt(allow), stringify: fmt(str), total: fmt(all) });
}
console.table(rows);
const key = await H.importHmac(); const payload = new TextEncoder().encode('v1.{"rc_id":"mlg1_x","exp":1}');
const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, payload));
console.log('hmac verify p50/p99', fmt(await time(500, () => H.hmacVerify(key, payload, mac))));
const fx = await H.ecdsaFixture();
console.log('ecdsa importKey+verify p50/p99', fmt(await time(300, () => H.ecdsaVerify(fx))));
const chunks = H.makeSseChunks(); console.log('tail scan result', JSON.stringify(H.tailScan(chunks)));
console.log('sse tail scan 2000 chunks p50/p99', fmt(await time(300, () => H.tailScan(chunks))));
