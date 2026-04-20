#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * Local CORS proxy for development web builds.
 * Forwards requests to any target URL, passing all headers and body through
 * unchanged, and adds CORS headers to the response so the browser allows it.
 *
 * Usage:
 *   node cors-server.js
 *
 * Then requests from the app hit:
 *   http://localhost:8090?url=<encoded-target-url>
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = 8090;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

// Headers that must not be forwarded to the upstream server
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

const server = http.createServer((req, res) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const targetUrl = reqUrl.searchParams.get('url');

  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
    res.end('Missing ?url= query parameter');
    return;
  }

  let target;
  try {
    target = new URL(targetUrl);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
    res.end(`Invalid target URL: ${targetUrl}`);
    return;
  }

  // Collect request body
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);

    // Log request
    console.log(`\n→ ${req.method} ${targetUrl}`);
    if (body.length > 0) {
      try {
        console.log('  body:', JSON.stringify(JSON.parse(body.toString()), null, 2));
      } catch {
        console.log('  body (raw):', body.toString());
      }
    }

    // Forward all headers except hop-by-hop, host, and accept-encoding
    // (drop accept-encoding so the upstream returns plaintext — readable in logs).
    const forwardHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (HOP_BY_HOP.has(lower)) {
        continue;
      }

      if (lower === 'host') {
        continue;
      }

      if (lower === 'accept-encoding') {
        continue;
      }

      forwardHeaders[key] = value;
    }
    forwardHeaders['host'] = target.host;

    const options = {
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      method: req.method,
      headers: forwardHeaders,
    };

    const transport = target.protocol === 'https:' ? https : http;

    // Log the headers actually being forwarded to the upstream
    console.log('  forwarded headers:');
    for (const [key, value] of Object.entries(forwardHeaders)) {
      // Redact auth values but show the key names so we know they're present
      const display =
        key.toLowerCase().includes('auth') || key.toLowerCase().includes('key')
          ? `${String(value).slice(0, 8)}...`
          : value;
      console.log(`    ${key}: ${display}`);
    }

    const proxyReq = transport.request(options, (proxyRes) => {
      // Collect response body for logging before piping
      const resChunks = [];
      proxyRes.on('data', (chunk) => resChunks.push(chunk));
      proxyRes.on('end', () => {
        const resBody = Buffer.concat(resChunks);
        console.log(`← ${proxyRes.statusCode} ${targetUrl}`);
        try {
          console.log('  response:', JSON.stringify(JSON.parse(resBody.toString()), null, 2));
        } catch {
          console.log('  response (raw):', resBody.toString().slice(0, 500));
        }

        const responseHeaders = {};
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          const lower = key.toLowerCase();
          if (!HOP_BY_HOP.has(lower) && !lower.startsWith('access-control-')) {
            responseHeaders[key] = value;
          }
        }
        Object.assign(responseHeaders, CORS_HEADERS);

        res.writeHead(proxyRes.statusCode, responseHeaders);
        res.end(resBody);
      });
    });

    proxyReq.on('error', (err) => {
      console.error(`✗ Proxy error for ${targetUrl}:`, err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
      }
      res.end(`Proxy error: ${err.message}`);
    });

    if (body.length > 0) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log(`CORS proxy listening on http://localhost:${PORT}`);
  console.log('Forwarding all headers and body to the target URL.\n');
});
