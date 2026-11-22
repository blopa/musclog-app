'use strict';
// Tiny read-first HTTP client. Secrets come from the environment only and are never printed.
const REQUEST_TIMEOUT_MS = 30_000;

async function request(base, token, method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // not JSON
  }

  if (!res.ok) {
    const code = json?.code ?? json?.error?.code ?? '';
    const err = new Error(
      `${method} ${path} -> HTTP ${res.status} ${code} ${json?.message ?? json?.error?.message ?? ''}`.trim()
    );
    err.status = res.status;
    throw err;
  }

  return json;
}

/** Follows RevenueCat's `next_page` / OpenRouter-style offset pagination for GETs. */
async function getAllRevenueCat(token, path) {
  const items = [];
  let next = path;
  while (next) {
    const page = await request(
      'https://api.revenuecat.com',
      token,
      'GET',
      next.replace(/^https:\/\/api\.revenuecat\.com/, '')
    );
    items.push(...(page.items ?? []));
    next = page.next_page ?? null;
  }

  return items;
}

module.exports = { request, getAllRevenueCat };
