#!/usr/bin/env node
/* eslint-disable no-undef */

const { execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8081;
const DIST_PATH = path.join(__dirname, '..', 'dist');
const BASE_PATH = '/musclog-app';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let filePath = url.pathname;

  if (filePath === BASE_PATH || filePath === BASE_PATH + '/') {
    filePath = path.join(BASE_PATH, 'index.html');
  }

  let relativePath = filePath;
  if (filePath.startsWith(BASE_PATH)) {
    relativePath = filePath.substring(BASE_PATH.length);
  }

  let fullPath = path.join(DIST_PATH, 'musclog-app', relativePath);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(fullPath).pipe(res);
  } else {
    if (filePath.startsWith(BASE_PATH)) {
      // SPA Fallback
      const indexPath = path.join(DIST_PATH, 'musclog-app', 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(indexPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }
});

function isServerUp() {
  return new Promise((resolve) => {
    http
      .get(`http://localhost:${PORT}${BASE_PATH}/`, (res) => {
        resolve(res.statusCode === 200);
      })
      .on('error', () => {
        resolve(false);
      });
  });
}

async function run() {
  console.log('Cleaning up existing servers...');
  try {
    execSync(`kill $(lsof -t -i :${PORT}) 2>/dev/null || true`);
  } catch (e) {}

  console.log('Starting built-in Node server...');
  server.listen(PORT, async () => {
    console.log(`Server listening on port ${PORT}`);

    console.log('Waiting for server to be ready...');
    let retries = 0;
    while (retries < 20) {
      if (await isServerUp()) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
      retries++;
    }

    if (retries === 20) {
      console.error('Server failed to start');
      process.exit(1);
    }

    console.log('Server is up. Running Playwright tests...');
    try {
      const args = process.argv.slice(2).join(' ');
      execSync(`npx playwright test ${args}`, { stdio: 'inherit' });
      console.log('Tests completed successfully.');
    } catch (e) {
      console.error('Tests failed.');
      process.exit(1);
    } finally {
      console.log('Shutting down server...');
      server.close();
    }
  });
}

run();
