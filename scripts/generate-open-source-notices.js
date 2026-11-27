/* eslint-disable no-undef */

// Writes data/openSourceNotices.json: every production npm dependency (found by
// walking package.json "dependencies" recursively through node_modules) with its
// licence and copyright line, plus one copy of each common licence text. The
// app's third-party notices screen reads that file, so MIT, ISC, BSD, Apache and
// MPL notice conditions are met inside the app.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data', 'openSourceNotices.json');

// Licence ids whose full text ships once in the notices file.
const TEXT_IDS = ['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'MPL-2.0'];

const LICENSE_FILE = /^(LICENSE|LICENCE|COPYING)(\.[a-z0-9]+)?$/i;
const NOTICE_FILE = /^NOTICE(\.[a-z0-9]+)?$/i;
const COPYRIGHT_LINE = /copyright/i;
const COPYRIGHT_MARK = /(\d{4}|\(c\)|©)/i;

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function findFileIn(dir, pattern) {
  let entries;
  try {
    entries = fs.readdirSync(dir).sort();
  } catch {
    return null;
  }

  const match = entries.find((entry) => pattern.test(entry));
  return match ? path.join(dir, match) : null;
}

// Node-style resolution: <dir>/node_modules/<name>, then each parent directory.
function resolvePackageDir(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }

    dir = parent;
  }
}

function licenseOf(pkg) {
  const raw = pkg.license;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }

  if (raw && typeof raw === 'object' && typeof raw.type === 'string' && raw.type.trim()) {
    return raw.type.trim();
  }

  if (Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
    const types = pkg.licenses
      .map((entry) => (entry && typeof entry.type === 'string' ? entry.type : ''))
      .filter(Boolean);
    if (types.length > 0) {
      return types.join(' OR ');
    }
  }

  return 'see package';
}

function authorOf(pkg) {
  if (typeof pkg.author === 'string') {
    return pkg.author
      .replace(/\s*<[^>]*>.*$/, '')
      .replace(/\s*\(.*\)\s*$/, '')
      .trim();
  }

  if (pkg.author && typeof pkg.author.name === 'string') {
    return pkg.author.name.trim();
  }

  return '';
}

// First line of the licence file that names a copyright holder and a year (or "(c)"/"©").
function copyrightFromText(text) {
  if (!text) {
    return '';
  }

  const line = text
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => COPYRIGHT_LINE.test(value) && COPYRIGHT_MARK.test(value));
  return line || '';
}

function copyrightOf(pkg, dir) {
  const licenseFile = findFileIn(dir, LICENSE_FILE);
  const fromLicense = licenseFile ? copyrightFromText(readText(licenseFile)) : '';
  return fromLicense || authorOf(pkg);
}

// Lines that are the package's own copyright notice, removed from shared texts.
function stripCopyrightLines(text) {
  const kept = text.split(/\r?\n/).filter((line) => !/^\s*(copyright\b|\(c\)|©)/i.test(line));
  return kept.join('\n').replace(/^\s+/, '').replace(/\s+$/, '');
}

function collectPackages(rootPkg, rootDir) {
  const byKey = new Map();
  const visitedDirs = new Set();
  const missing = [];
  const queue = [];

  const enqueueDeps = (pkg, fromDir) => {
    for (const name of Object.keys(pkg.dependencies || {}).sort()) {
      queue.push({ name, fromDir });
    }
  };

  enqueueDeps(rootPkg, rootDir);

  while (queue.length > 0) {
    const { name, fromDir } = queue.shift();
    const dir = resolvePackageDir(name, fromDir);
    if (!dir) {
      missing.push(name);
      continue;
    }

    const real = fs.realpathSync(dir);
    if (visitedDirs.has(real)) {
      continue;
    }

    visitedDirs.add(real);

    const pkg = JSON.parse(readText(path.join(dir, 'package.json')));
    const version = typeof pkg.version === 'string' ? pkg.version : '';
    const key = `${pkg.name || name}@${version}`;
    if (!byKey.has(key)) {
      const entry = {
        name: pkg.name || name,
        version,
        license: licenseOf(pkg),
        copyright: copyrightOf(pkg, dir),
        dir,
      };
      if (entry.license === 'Apache-2.0') {
        const noticeFile = findFileIn(dir, NOTICE_FILE);
        const notice = noticeFile ? (readText(noticeFile) || '').trim() : '';
        if (notice) {
          entry.notice = notice;
        }
      }

      byKey.set(key, entry);
    }

    enqueueDeps(pkg, dir);
  }

  return { entries: [...byKey.values()], missing };
}

function compareEntries(a, b) {
  if (a.name !== b.name) {
    return a.name < b.name ? -1 : 1;
  }

  if (a.version !== b.version) {
    return a.version < b.version ? -1 : 1;
  }

  return 0;
}

// One copy of each licence text, from the first package (by name) that declares exactly that id.
function collectTexts(entries) {
  const texts = {};
  const sorted = [...entries].sort(compareEntries);
  for (const id of TEXT_IDS) {
    for (const entry of sorted) {
      if (entry.license !== id) {
        continue;
      }

      const file = findFileIn(entry.dir, LICENSE_FILE);
      const body = file ? readText(file) : null;
      if (body && body.trim()) {
        texts[id] = stripCopyrightLines(body);
        break;
      }
    }
  }

  return texts;
}

function buildNotices(rootDir) {
  const rootPkg = JSON.parse(readText(path.join(rootDir, 'package.json')));
  const { entries, missing } = collectPackages(rootPkg, rootDir);
  const sorted = entries.sort(compareEntries);
  const texts = collectTexts(sorted);
  const packages = sorted.map(({ dir, ...rest }) => rest);
  return { packages, texts, missing };
}

function serialize(notices) {
  return `${JSON.stringify({ packages: notices.packages, texts: notices.texts }, null, 2)}\n`;
}

module.exports = {
  TEXT_IDS,
  buildNotices,
  copyrightFromText,
  licenseOf,
  serialize,
  stripCopyrightLines,
};

if (require.main === module) {
  const notices = buildNotices(ROOT);
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, serialize(notices));
  console.log(
    `Wrote ${notices.packages.length} packages and ${Object.keys(notices.texts).length} licence texts to ${path.relative(ROOT, OUTPUT)}`
  );
  if (notices.missing.length > 0) {
    console.warn(`Not installed, skipped: ${[...new Set(notices.missing)].join(', ')}`);
  }
}
