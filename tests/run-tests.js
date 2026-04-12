#!/usr/bin/env node
const { spawn } = require('child_process');
const http = require('http');
/* global __dirname */
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
  '.webp': 'image/webp',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let filePath = url.pathname;

  // Handle base path redirect
  if (filePath === '/' || filePath === '') {
    res.writeHead(302, { Location: BASE_PATH + '/' });
    res.end();
    return;
  }

  let relativePath = filePath;
  if (filePath.startsWith(BASE_PATH)) {
    relativePath = filePath.substring(BASE_PATH.length);
  } else {
    // If it doesn't start with BASE_PATH and it's not a root redirect, 404
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  if (relativePath === '/' || relativePath === '') {
    relativePath = '/index.html';
  }

  let fullPath = path.join(DIST_PATH, relativePath);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(fullPath).pipe(res);
  } else {
    // SPA Fallback: serve index.html for any sub-path of BASE_PATH
    const indexPath = path.join(DIST_PATH, 'index.html');
    if (fs.existsSync(indexPath)) {
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

function runPlaywright() {
  return new Promise((resolve, reject) => {
    const args = process.argv.slice(2);
    console.log(`Running: npx playwright test ${args.join(' ')}`);

    const pw = spawn('npx', ['playwright', 'test', ...args], {
      stdio: 'inherit',
      shell: true,
    });

    pw.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Playwright exited with code ${code}`));
      }
    });
  });
}

async function run() {
  const alreadyUp = await isServerUp();

  if (alreadyUp) {
    console.log(`Server already running on port ${PORT}, reusing it.`);
    try {
      await runPlaywright();
    } catch (e) {
      console.error('Tests failed:', e.message);
      process.exit(1);
    }
    return;
  }

  const distIndex = path.join(DIST_PATH, 'index.html');
  if (!fs.existsSync(distIndex)) {
    console.error(`No built app found at ${distIndex}.\nMake sure you have run the build command.`);
    process.exit(1);
  }

  console.log('Starting built-in Node server...');
  server.listen(PORT, async () => {
    console.log(`Server listening on port ${PORT} at ${BASE_PATH}`);

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
      console.error('Tests failed:', e.message);
      process.exit(1);
    } finally {
      console.log('Shutting down server...');
      server.close();
    }
  });
}

run();
