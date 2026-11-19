/* eslint-disable no-undef */

/**
 * Service-account auth and a tiny JSON client for Google's REST APIs, with no dependencies: the JWT
 * bearer grant (RFC 7523) is signed with node:crypto and exchanged for an access token. Used by the
 * online-presence tooling (docs/ONLINE_PRESENCE.md) for Search Console and Google Analytics 4.
 *
 * Read-only scopes only: this tooling never changes anything in Google's consoles.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');

const SCOPES = {
  searchConsole: 'https://www.googleapis.com/auth/webmasters.readonly',
  analytics: 'https://www.googleapis.com/auth/analytics.readonly',
};

const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const TOKEN_LIFETIME_SECONDS = 3600;
const REFRESH_MARGIN_MS = 60_000;

const tokenCache = new Map();

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

/** Reads and validates a service-account key file. Never logs the private key. */
function readServiceAccountKey(keyPath) {
  let parsed;

  try {
    parsed = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read the service-account key at ${keyPath}: ${error.message}`);
  }

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(`${keyPath} is not a service-account key (no client_email / private_key).`);
  }

  return parsed;
}

/** Builds the signed JWT assertion for a scope list. Pure given `nowMs`. */
function buildAssertion(key, scopes, nowMs) {
  const issuedAt = Math.floor(nowMs / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: scopes.join(' '),
      aud: key.token_uri || DEFAULT_TOKEN_URI,
      iat: issuedAt,
      exp: issuedAt + TOKEN_LIFETIME_SECONDS,
    })
  );
  const unsigned = `${header}.${claims}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(key.private_key);

  return `${unsigned}.${base64url(signature)}`;
}

/**
 * Returns an access token for the key and scopes, cached until a minute before it expires.
 * `fetchImpl` and `nowMs` exist for tests.
 */
async function getAccessToken(keyPath, scopes, { fetchImpl = fetch, nowMs = Date.now() } = {}) {
  const cacheKey = `${keyPath}|${scopes.join(' ')}`;
  const cached = tokenCache.get(cacheKey);

  if (cached && cached.expiresAtMs - REFRESH_MARGIN_MS > nowMs) {
    return cached.token;
  }

  const key = readServiceAccountKey(keyPath);
  const response = await fetchImpl(key.token_uri || DEFAULT_TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: buildAssertion(key, scopes, nowMs),
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.access_token) {
    throw new Error(
      `Google refused the service-account sign-in (${response.status}): ${payload.error_description || payload.error || 'no detail'}`
    );
  }

  tokenCache.set(cacheKey, {
    token: payload.access_token,
    expiresAtMs: nowMs + (payload.expires_in || TOKEN_LIFETIME_SECONDS) * 1000,
  });

  return payload.access_token;
}

/** Turns a Google API error body into one actionable sentence. */
function describeGoogleError(status, body, url) {
  const error = body && body.error ? body.error : {};
  const message = error.message || `HTTP ${status}`;
  const details = Array.isArray(error.details) ? error.details : [];
  const disabled = details.find((detail) => detail.reason === 'SERVICE_DISABLED');

  if (disabled) {
    const link = disabled.metadata && disabled.metadata.activationUrl;

    return `${message} Enable the API for the service account's Google Cloud project${link ? `: ${link}` : '.'}`;
  }

  if (status === 403) {
    return `${message} The service account has no access to this resource: add its email as a user in Search Console (Settings → Users and permissions) or as a Viewer in Google Analytics (Admin → Property access management).`;
  }

  return `${message} (${status}, ${url})`;
}

/** One JSON request. Throws an Error whose message says what to do. */
async function googleJson(url, { token, method = 'GET', body, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(describeGoogleError(response.status, payload, url));
  }

  return payload;
}

function clearTokenCache() {
  tokenCache.clear();
}

module.exports = {
  SCOPES,
  buildAssertion,
  clearTokenCache,
  describeGoogleError,
  getAccessToken,
  googleJson,
  readServiceAccountKey,
};
