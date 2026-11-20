// Worker hot-path pieces, pure JS + WebCrypto (identical code runs in Node and workerd).
const enc = new TextEncoder();

export function makeBody(imageBytes) {
  // base64 length ~ 4/3 of bytes; fill with pseudo-random base64 chars
  const n = Math.ceil(imageBytes / 3) * 4;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let s = ''; const chunk = []; let x = 12345;
  for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; chunk.push(alphabet[x & 63]); if (chunk.length === 8192) { s += chunk.join(''); chunk.length = 0; } }
  s += chunk.join('');
  return JSON.stringify({
    model: 'musclog-hosted', stream: true, max_tokens: 1200, temperature: 0.4, top_p: 1, n: 1,
    messages: [{ role: 'system', content: 'You are a coach.' }, { role: 'user', content: [{ type: 'text', text: 'Estimate this meal' }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + s } }] }],
    response_format: { type: 'json_schema', json_schema: { name: 'meal', strict: true, schema: { type: 'object', properties: { kcal: { type: 'number' } }, required: ['kcal'], additionalProperties: false } } },
    tools: [], evil_field: { a: 1 }, provider: { order: ['x'] },
  });
}

const clamp = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
export function allowlist(b) {
  const out = { model: 'upstream/model', stream: b.stream === true, max_tokens: clamp(b.max_tokens, 1, 2000, 800), temperature: clamp(b.temperature, 0, 1.5, 0.7), top_p: clamp(b.top_p, 0, 1, 1) };
  if (!Array.isArray(b.messages) || b.messages.length > 64) throw new Error('messages');
  out.messages = b.messages.map((m) => {
    if (typeof m.role !== 'string') throw new Error('role');
    if (typeof m.content === 'string') return { role: m.role, content: m.content };
    if (!Array.isArray(m.content)) throw new Error('content');
    return { role: m.role, content: m.content.map((p) => {
      if (p.type === 'text' && typeof p.text === 'string') return { type: 'text', text: p.text };
      if (p.type === 'image_url' && typeof p.image_url?.url === 'string' && p.image_url.url.startsWith('data:image/jpeg;base64,')) return { type: 'image_url', image_url: { url: p.image_url.url } };
      throw new Error('part');
    }) };
  });
  if (b.response_format?.type === 'json_schema') out.response_format = { type: 'json_schema', json_schema: b.response_format.json_schema };
  return out;
}

export async function importHmac() { return crypto.subtle.importKey('raw', enc.encode('k'.repeat(32)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }
export async function hmacVerify(key, payload, mac) { return crypto.subtle.verify('HMAC', key, mac, payload); }
export async function ecdsaFixture() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const msg = enc.encode('musclog-premium-v1\nsession\nmlg1_x\nnonce\nbodyhash');
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, msg));
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  return { raw, msg, sig };
}
export async function ecdsaVerify({ raw, msg, sig }) {
  const key = await crypto.subtle.importKey('raw', raw, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, msg);
}

// Streaming tail scan: keep last 2 KB of 2000 SSE chunks, then find the final usage object.
export function makeSseChunks(n = 2000) {
  const chunks = [];
  for (let i = 0; i < n - 1; i++) chunks.push(enc.encode(`data: {"id":"gen-1","choices":[{"delta":{"content":"tok${i} "}}]}\n\n`));
  chunks.push(enc.encode(`data: {"id":"gen-1","choices":[],"usage":{"prompt_tokens":812,"completion_tokens":300,"total_tokens":1112,"cost":0.00123}}\n\ndata: [DONE]\n\n`));
  return chunks;
}
export function tailScan(chunks) {
  const TAIL = 2048; let buf = new Uint8Array(TAIL * 2); let len = 0;
  for (const c of chunks) {
    if (len + c.length > buf.length) { // compact: keep last TAIL bytes
      const keep = Math.min(len, TAIL); buf.copyWithin(0, len - keep, len); len = keep;
    }
    buf.set(c, len); len += c.length;
  }
  const text = new TextDecoder().decode(buf.subarray(Math.max(0, len - TAIL), len));
  const i = text.lastIndexOf('"usage"'); if (i < 0) return null;
  const j = text.indexOf('{', i); let d = 0, k = j;
  for (; k < text.length; k++) { if (text[k] === '{') d++; else if (text[k] === '}' && --d === 0) break; }
  return JSON.parse(text.slice(j, k + 1));
}
