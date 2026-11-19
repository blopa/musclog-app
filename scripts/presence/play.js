/**
 * Google Play side of the online-presence tooling, read-only, through the same `gplay` CLI and profile
 * the publishing scripts use (docs/GOOGLE_PLAY.md): reviews, the release-health snapshot, and, when the
 * Cloud Storage bucket id is configured, the Play Console "store_performance" statistics (listing
 * visitors, installs from the listing, by country and traffic source).
 *
 * Limits worth knowing: the Reviews API returns only reviews from the last week, so reviews are merged
 * into `.presence/play-reviews.json` on every run to build a history; the Play Developer API has no
 * search-term report, so listing keywords come from the Play Console UI and the store_performance
 * traffic-source file only.
 */
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');

const { PLAY_PACKAGE, PRESENCE_DIR } = require('./config');

const execFileAsync = promisify(execFile);
const REVIEWS_ARCHIVE = path.join(PRESENCE_DIR, 'play-reviews.json');
const STATS_DIR = path.join(PRESENCE_DIR, 'play-stats');
const GPLAY_TIMEOUT_MS = 120_000;

async function runGplay(args, { profile = 'musclog', exec = execFileAsync } = {}) {
  const { stdout } = await exec('gplay', args, {
    timeout: GPLAY_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, GPLAY_PROFILE: profile, GPLAY_PACKAGE: PLAY_PACKAGE },
  });

  return stdout;
}

async function gplayJson(args, options) {
  const stdout = await runGplay(args, options);

  return (stdout.trim() ? JSON.parse(stdout) : null) ?? {};
}

/** One review as the analysis wants it. */
function normalizeReview(review) {
  const comments = review.comments ?? [];
  const user = comments.find((entry) => entry.userComment)?.userComment ?? {};
  const developer = comments.find((entry) => entry.developerComment)?.developerComment ?? null;
  const seconds = Number(user.lastModified?.seconds ?? 0);

  return {
    id: review.reviewId,
    stars: user.starRating ?? null,
    text: (user.text ?? '').trim(),
    language: user.reviewerLanguage ?? null,
    appVersion: user.appVersionName ?? null,
    device: user.deviceMetadata?.productName ?? null,
    date: seconds ? new Date(seconds * 1000).toISOString().slice(0, 10) : null,
    replied: Boolean(developer),
  };
}

function normalizeReviews(payload) {
  return (payload.reviews ?? []).map(normalizeReview).filter((review) => review.id);
}

/** Adds new reviews to the archive (by id; a later copy wins, since reviews can be edited). */
function mergeReviews(archive, incoming) {
  const byId = new Map(archive.map((review) => [review.id, review]));

  for (const review of incoming) {
    byId.set(review.id, review);
  }

  return [...byId.values()].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

function summarizeReviews(reviews) {
  const rated = reviews.filter((review) => typeof review.stars === 'number');
  const byStars = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const review of rated) {
    byStars[review.stars] = (byStars[review.stars] ?? 0) + 1;
  }

  return {
    count: reviews.length,
    average:
      rated.length > 0 ? rated.reduce((sum, review) => sum + review.stars, 0) / rated.length : null,
    byStars,
    unreplied: reviews.filter((review) => !review.replied && review.text).length,
  };
}

function readReviewArchive(file = REVIEWS_ARCHIVE) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

async function fetchReviews({ profile, exec } = {}) {
  const payload = await gplayJson(
    [
      'reviews',
      'list',
      '--package',
      PLAY_PACKAGE,
      '--max-results',
      '100',
      '--paginate',
      '--translation-language',
      'en-US',
    ],
    { profile, exec }
  );
  const merged = mergeReviews(readReviewArchive(), normalizeReviews(payload));

  fs.mkdirSync(path.dirname(REVIEWS_ARCHIVE), { recursive: true });
  fs.writeFileSync(REVIEWS_ARCHIVE, `${JSON.stringify(merged, null, 2)}\n`);

  return {
    summary: summarizeReviews(merged),
    recent: merged.slice(0, 30),
    newThisRun: normalizeReviews(payload).length,
  };
}

/** gplay's deterministic release-health snapshot (crash and ANR rates, tracks). */
function fetchReleaseHealth({ profile, exec } = {}) {
  return gplayJson(['status', '--package', PLAY_PACKAGE], { profile, exec });
}

/** Play statistics CSVs are UTF-16LE with a BOM; fall back to UTF-8. */
function decodeCsvBuffer(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le');
  }

  return buffer.toString('utf8').replace(/^﻿/, '');
}

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF. Returns objects keyed by header. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') {
        index += 1;
      }

      row.push(field);
      field = '';

      if (row.some((cell) => cell !== '')) {
        rows.push(row);
      }

      row = [];
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows;

  return header
    ? body.map((cells) =>
        Object.fromEntries(header.map((name, index) => [name.trim(), cells[index] ?? '']))
      )
    : [];
}

/**
 * Sums store-listing visitors and acquisitions by one dimension column of a store_performance file.
 * Column names are matched loosely because Google renames them between report versions.
 */
function summarizeStorePerformance(rows, dimensionPattern) {
  if (rows.length === 0) {
    return [];
  }

  const columns = Object.keys(rows[0]);
  const dimension = columns.find((column) => dimensionPattern.test(column));
  const visitors = columns.find((column) => /visitors/i.test(column));
  const acquisitions = columns.find((column) => /acquisitions/i.test(column));

  if (!dimension || !visitors || !acquisitions) {
    return [];
  }

  const byKey = new Map();

  for (const row of rows) {
    const key = row[dimension] || 'unknown';
    const entry = byKey.get(key) ?? { key, visitors: 0, acquisitions: 0 };

    entry.visitors += Number(row[visitors]) || 0;
    entry.acquisitions += Number(row[acquisitions]) || 0;
    byKey.set(key, entry);
  }

  return [...byKey.values()]
    .map((entry) => ({
      ...entry,
      conversion: entry.visitors > 0 ? entry.acquisitions / entry.visitors : null,
    }))
    .sort((a, b) => b.visitors - a.visitors);
}

/** Downloads the store_performance CSVs of a month range and summarizes them. Needs the bucket id. */
async function fetchStorePerformance({ bucket, fromMonth, toMonth, profile, exec } = {}) {
  if (!bucket) {
    return {
      skipped:
        'No Play statistics bucket configured (MUSCLOG_PLAY_STATS_BUCKET or .presence/config.json playStatsBucket).',
    };
  }

  const dir = path.join(STATS_DIR, `${fromMonth}_${toMonth}`);

  fs.mkdirSync(dir, { recursive: true });
  await runGplay(
    [
      'reports',
      'stats',
      'download',
      '--bucket-id',
      bucket,
      '--package',
      PLAY_PACKAGE,
      '--type',
      'store_performance',
      '--from',
      fromMonth,
      '--to',
      toMonth,
      '--dir',
      dir,
    ],
    { profile, exec }
  );

  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.csv'));
  const read = (suffix) => {
    const file = files.find((name) => name.includes(suffix));

    return file ? parseCsv(decodeCsvBuffer(fs.readFileSync(path.join(dir, file)))) : [];
  };

  return {
    files,
    byCountry: summarizeStorePerformance(read('country'), /country/i).slice(0, 15),
    byTrafficSource: summarizeStorePerformance(read('traffic'), /source|channel/i).slice(0, 15),
    overall: summarizeStorePerformance(read('overview'), /date/i).slice(-31),
  };
}

module.exports = {
  decodeCsvBuffer,
  fetchReleaseHealth,
  fetchReviews,
  fetchStorePerformance,
  mergeReviews,
  normalizeReview,
  normalizeReviews,
  parseCsv,
  summarizeReviews,
  summarizeStorePerformance,
};
