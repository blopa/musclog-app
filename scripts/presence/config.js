/* eslint-disable no-undef */

/**
 * Where the online-presence tooling finds its key, its Search Console property, its GA4 property and
 * its date windows. Environment variables beat `.presence/config.json`, which beats the defaults.
 * Nothing here is secret except the key FILE, which stays outside the repo (docs/ONLINE_PRESENCE.md).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PRESENCE_DIR = path.join(REPO_ROOT, '.presence');
const CONFIG_PATH = path.join(PRESENCE_DIR, 'config.json');
const SNAPSHOTS_DIR = path.join(PRESENCE_DIR, 'snapshots');

const SITE_ORIGIN = 'https://musclog.app';
const PLAY_PACKAGE = 'com.werules.logger';
// The measurement id the website's gtag uses (utils/websiteAnalytics.web.ts); the Data API needs the
// numeric property id, which `presence check` finds by matching this against the account's streams.
const GA_MEASUREMENT_ID = 'G-176QWPGYFM';

// Search Console lags by about two days, and the last day or two are still partial.
const GSC_LAG_DAYS = 3;
const DAY_MS = 86_400_000;

function keyCandidates(env = process.env, home = os.homedir()) {
  return [
    env.MUSCLOG_PRESENCE_KEY,
    path.join(home, 'keys', 'musclog-presence-service-account.json'),
    // The Play publishing key works too once its email is added to Search Console / GA4.
    path.join(home, 'keys', 'musclog-play-service-account.json'),
  ].filter(Boolean);
}

function findKeyPath(env = process.env, home = os.homedir(), exists = fs.existsSync) {
  return keyCandidates(env, home).find((candidate) => exists(candidate)) ?? null;
}

function readFileConfig(configPath = CONFIG_PATH) {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
}

function loadConfig({ env = process.env, configPath = CONFIG_PATH } = {}) {
  const file = readFileConfig(configPath);

  return {
    gscSite: env.MUSCLOG_GSC_SITE || file.gscSite || null,
    ga4Property:
      String(env.MUSCLOG_GA4_PROPERTY || file.ga4Property || '').replace(/^properties\//, '') ||
      null,
    playStatsBucket: env.MUSCLOG_PLAY_STATS_BUCKET || file.playStatsBucket || null,
    playProfile: env.GPLAY_PROFILE || file.playProfile || 'musclog',
  };
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  return isoDay(new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS));
}

/**
 * The window of `days` days ending `lagDays` before `today`, and the equally long window right before
 * it. Both are inclusive on both ends, in UTC calendar days.
 */
function dateWindows(days, { today = new Date(), lagDays = GSC_LAG_DAYS } = {}) {
  const end = addDays(isoDay(today), -lagDays);
  const start = addDays(end, -(days - 1));
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(days - 1));

  return {
    days,
    current: { start, end },
    previous: { start: previousStart, end: previousEnd },
  };
}

module.exports = {
  CONFIG_PATH,
  GA_MEASUREMENT_ID,
  GSC_LAG_DAYS,
  PLAY_PACKAGE,
  PRESENCE_DIR,
  REPO_ROOT,
  SITE_ORIGIN,
  SNAPSHOTS_DIR,
  addDays,
  dateWindows,
  findKeyPath,
  isoDay,
  keyCandidates,
  loadConfig,
};
