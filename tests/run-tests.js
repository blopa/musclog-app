#!/usr/bin/env node
/* eslint-disable no-undef */

const { execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8081;
const DIST_PATH = path.join(__dirname, '..', 'dist');
const BASE_PATH = '/';

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

  let fullPath = path.join(DIST_PATH, relativePath);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(fullPath).pipe(res);
  } else {
    if (filePath.startsWith(BASE_PATH)) {
      // SPA Fallback
      const indexPath = path.join(DIST_PATH, 'index.html');
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
      .get(`http://localhost:${PORT}/`, (res) => {
        resolve(res.statusCode === 200);
      })
      .on('error', () => {
        resolve(false);
      });
  });
}

async function runPlaywright() {
  const args = process.argv.slice(2).join(' ');
  execSync(`npx playwright test ${args}`, { stdio: 'inherit' });
  console.log('Tests completed successfully.');
}

async function run() {
  const alreadyUp = await isServerUp();

  if (alreadyUp) {
    console.log(`Server already running on port ${PORT}, reusing it.`);
    try {
      await runPlaywright();
    } catch (e) {
      console.error('Tests failed.');
      process.exit(1);
    }
    return;
  }

  const distIndex = path.join(DIST_PATH, 'index.html');
  if (!fs.existsSync(distIndex)) {
    console.error(
      `No built app found at ${distIndex}.\nRun "npm run build:web" first, or start the dev server with "npm run web" and re-run this script.`
    );
    process.exit(1);
  }

  console.log('Starting built-in Node server...');
  server.listen(PORT, async () => {
    console.log(`Server listening on port ${PORT}`);

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
      await runPlaywright();
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
