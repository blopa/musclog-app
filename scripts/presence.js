#!/usr/bin/env node
/**
 * Online-presence research tooling for Musclog (docs/ONLINE_PRESENCE.md). Read-only: collects Search
 * Console, Google Analytics 4, Google Play and an offline audit of the site into a dated snapshot under
 * `.presence/` (git-ignored) and renders a digest the `musclog-online-presence-research` skill reads.
 *
 *   node scripts/presence.js check
 *   node scripts/presence.js snapshot [--days 28] [--only gsc,ga4,play,audit,live]
 *   node scripts/presence.js report [--snapshot <dir>] [--json]
 *   node scripts/presence.js inspect <url> [<url>...]
 *   node scripts/presence.js ledger
 */
const fs = require('node:fs');
const path = require('node:path');

const { chooseProperty, createAnalytics } = require('./presence/analytics');
const {
  GA_MEASUREMENT_ID,
  PRESENCE_DIR,
  SITE_ORIGIN,
  SNAPSHOTS_DIR,
  dateWindows,
  findKeyPath,
  isoDay,
  loadConfig,
} = require('./presence/config');
const { dueEntries, readLedger } = require('./presence/ledger');
const { checkUrls, summarizeLiveCheck } = require('./presence/liveCheck');
const play = require('./presence/play');
const { buildDigest, renderMarkdown } = require('./presence/report');
const { chooseSite, createSearchConsole } = require('./presence/searchConsole');
const { auditSite } = require('./presence/siteAudit');

const ALL_SOURCES = ['gsc', 'ga4', 'play', 'audit', 'live'];
const DEFAULT_DAYS = 28;

function parseArgs(argv) {
  const positional = [];
  const flags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg.startsWith('--')) {
      const [name, inline] = arg.slice(2).split('=');

      if (inline !== undefined) {
        flags[name] = inline;
      } else if (argv[index + 1] && !argv[index + 1].startsWith('--')) {
        flags[name] = argv[(index += 1)];
      } else {
        flags[name] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

function requireKey() {
  const keyPath = findKeyPath();

  if (!keyPath) {
    throw new Error(
      'No service-account key found. Put one at ~/keys/musclog-presence-service-account.json or set MUSCLOG_PRESENCE_KEY (see docs/ONLINE_PRESENCE.md → Setup).'
    );
  }

  return keyPath;
}

async function resolveSite(searchConsole, config) {
  const sites = await searchConsole.listSites();
  const site = chooseSite(sites, { configured: config.gscSite });

  if (!site) {
    const visible = sites.map((entry) => entry.siteUrl).join(', ') || 'none';

    throw new Error(
      `No Search Console property for musclog.app is visible to this service account (it sees: ${visible}). Add its email as a user of the property, or set MUSCLOG_GSC_SITE.`
    );
  }

  return site;
}

async function resolveGa4Property(analyticsFactory, config) {
  if (config.ga4Property) {
    return config.ga4Property;
  }

  const discovery = analyticsFactory('discover');
  const found = chooseProperty(await discovery.discoverProperties(), GA_MEASUREMENT_ID);

  if (!found) {
    throw new Error(
      `No GA4 property with measurement id ${GA_MEASUREMENT_ID} is visible to this service account. Add its email as a Viewer, or set MUSCLOG_GA4_PROPERTY to the numeric property id.`
    );
  }

  return found.property;
}

async function collectGsc({ keyPath, config, window }) {
  const searchConsole = createSearchConsole({ keyPath });
  const site = await resolveSite(searchConsole, config);
  const query = (range, dimensions) =>
    searchConsole.searchAnalytics(site, { startDate: range.start, endDate: range.end, dimensions });
  const [
    queries,
    queriesPrevious,
    pages,
    pagesPrevious,
    queryPages,
    countries,
    devices,
    devicesPrevious,
    daily,
    sitemaps,
  ] = await Promise.all([
    query(window.current, ['query']),
    query(window.previous, ['query']),
    query(window.current, ['page']),
    query(window.previous, ['page']),
    query(window.current, ['query', 'page']),
    query(window.current, ['country']),
    query(window.current, ['device']),
    query(window.previous, ['device']),
    query(window.current, ['date']),
    searchConsole.listSitemaps(site).catch(() => []),
  ]);

  return {
    site,
    queries,
    queriesPrevious,
    pages,
    pagesPrevious,
    queryPages,
    countries,
    devices,
    devicesPrevious,
    daily,
    sitemaps,
  };
}

async function collectGa4({ keyPath, config, window }) {
  const property = await resolveGa4Property(
    () => createAnalytics({ keyPath, propertyId: 'none' }),
    config
  );
  const analytics = createAnalytics({ keyPath, propertyId: property });
  const range = { startDate: window.current.start, endDate: window.current.end };
  const [landingPages, sources, countries, devices, conversions, daily] = await Promise.all([
    analytics.landingPages(range),
    analytics.sources(range),
    analytics.countries(range),
    analytics.devices(range),
    analytics.conversions(range),
    analytics.daily(range),
  ]);

  return { property, landingPages, sources, countries, devices, conversions, daily };
}

async function collectPlay({ config, window }) {
  const profile = config.playProfile;
  const [reviews, health] = await Promise.all([
    play.fetchReviews({ profile }),
    play.fetchReleaseHealth({ profile }).catch((error) => ({ error: error.message })),
  ]);
  const storePerformance = await play
    .fetchStorePerformance({
      bucket: config.playStatsBucket,
      fromMonth: window.current.start.slice(0, 7),
      toMonth: window.current.end.slice(0, 7),
      profile,
    })
    .catch((error) => ({ skipped: `Could not read store performance: ${error.message}` }));

  return { reviews, health, storePerformance };
}

const COLLECTORS = {
  gsc: collectGsc,
  ga4: collectGa4,
  play: collectPlay,
  audit: async () => auditSite(),
  live: async () => {
    const urls = auditSite().sitemapUrls ?? [];

    if (urls.length === 0) {
      throw new Error('No sitemap URLs to check (public/sitemap.xml is missing or empty).');
    }

    return summarizeLiveCheck(await checkUrls(urls), urls.length);
  },
};

/** One failing source never loses the others: its error is recorded and the run goes on. */
async function takeSnapshot({ days, only }) {
  const config = loadConfig();
  const window = dateWindows(days);
  const keyPath = findKeyPath();
  const sources = {};

  await Promise.all(
    only.map(async (name) => {
      try {
        if ((name === 'gsc' || name === 'ga4') && !keyPath) {
          requireKey();
        }

        sources[name] = { ok: true, data: await COLLECTORS[name]({ keyPath, config, window }) };
      } catch (error) {
        sources[name] = { ok: false, error: error.message };
      }
    })
  );

  return { generatedAt: new Date().toISOString(), window, sources };
}

function snapshotDirs() {
  return fs.existsSync(SNAPSHOTS_DIR)
    ? fs
        .readdirSync(SNAPSHOTS_DIR)
        .filter((name) => /^\d{4}-\d{2}-\d{2}/.test(name))
        .sort()
    : [];
}

function writeSnapshot(snapshot) {
  const name = snapshot.generatedAt.slice(0, 16).replace(/[T:]/g, '-');
  const dir = path.join(SNAPSHOTS_DIR, name);
  const digest = buildDigest(snapshot, { ledgerDue: dueEntries(readLedger(), isoDay(new Date())) });

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'snapshot.json'), JSON.stringify(snapshot));
  fs.writeFileSync(path.join(dir, 'digest.json'), JSON.stringify(digest, null, 2));
  fs.writeFileSync(path.join(dir, 'report.md'), renderMarkdown(digest));

  return dir;
}

async function commandSnapshot({ flags }) {
  const days = Number(flags.days) || DEFAULT_DAYS;
  const only = flags.only ? String(flags.only).split(',') : ALL_SOURCES;
  const unknown = only.filter((name) => !ALL_SOURCES.includes(name));

  if (unknown.length > 0) {
    throw new Error(
      `Unknown source(s): ${unknown.join(', ')}. Choose from ${ALL_SOURCES.join(', ')}.`
    );
  }

  const snapshot = await takeSnapshot({ days, only });
  const dir = writeSnapshot(snapshot);

  for (const [name, source] of Object.entries(snapshot.sources)) {
    console.log(
      `${source.ok ? 'ok     ' : 'FAILED '} ${name}${source.ok ? '' : `: ${source.error}`}`
    );
  }

  console.log(`\nSnapshot written to ${path.relative(process.cwd(), dir)}`);
  console.log(`Read ${path.relative(process.cwd(), path.join(dir, 'report.md'))}`);
}

function commandReport({ flags }) {
  const dir = flags.snapshot
    ? path.resolve(String(flags.snapshot))
    : path.join(SNAPSHOTS_DIR, snapshotDirs().at(-1) ?? '');
  const file = path.join(dir, 'snapshot.json');

  if (!fs.existsSync(file)) {
    throw new Error('No snapshot yet. Run `node scripts/presence.js snapshot` first.');
  }

  const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
  const digest = buildDigest(snapshot, { ledgerDue: dueEntries(readLedger(), isoDay(new Date())) });

  console.log(flags.json ? JSON.stringify(digest, null, 2) : renderMarkdown(digest));
}

async function commandInspect({ positional }) {
  const urls = positional.slice(1);

  if (urls.length === 0) {
    throw new Error('Usage: presence inspect <url> [<url>...]');
  }

  const searchConsole = createSearchConsole({ keyPath: requireKey() });
  const site = await resolveSite(searchConsole, loadConfig());

  for (const url of urls) {
    const full = url.startsWith('http')
      ? url
      : `${SITE_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;

    console.log(JSON.stringify(await searchConsole.inspectUrl(site, full), null, 2));
  }
}

function commandLedger() {
  const entries = readLedger();
  const due = dueEntries(entries, isoDay(new Date()));

  console.log(`${entries.length} ledger entries, ${due.length} due for review.`);
  for (const entry of due) {
    console.log(`- ${entry.date} ${entry.target}: ${entry.change} (review on ${entry.reviewOn})`);
  }
}

/** Says what works and exactly what to do about what does not. Never prints a secret. */
async function commandCheck() {
  const config = loadConfig();
  const keyPath = findKeyPath();
  let failures = 0;
  const report = (ok, label, detail) => {
    console.log(`${ok ? 'ok     ' : 'MISSING'} ${label}${detail ? `: ${detail}` : ''}`);
    failures += ok ? 0 : 1;
  };

  report(
    Boolean(keyPath),
    'service-account key',
    keyPath ?? 'none at ~/keys/musclog-presence-service-account.json (set MUSCLOG_PRESENCE_KEY)'
  );

  if (keyPath) {
    const { readServiceAccountKey } = require('./presence/googleAuth');
    const email = readServiceAccountKey(keyPath).client_email;

    console.log(`        service account email: ${email} (add it in Search Console and GA4)`);

    try {
      const searchConsole = createSearchConsole({ keyPath });
      const site = await resolveSite(searchConsole, config);
      const sitemaps = await searchConsole.listSitemaps(site);

      report(true, 'Search Console', `${site}, ${sitemaps.length} sitemap(s) submitted`);
    } catch (error) {
      report(false, 'Search Console', error.message);
    }

    try {
      const property = await resolveGa4Property(
        () => createAnalytics({ keyPath, propertyId: 'none' }),
        config
      );

      report(true, 'Google Analytics 4', `property ${property}`);
    } catch (error) {
      report(false, 'Google Analytics 4', error.message);
    }
  }

  try {
    const health = await play.fetchReleaseHealth({ profile: config.playProfile });

    report(
      true,
      'Google Play (gplay)',
      `profile ${config.playProfile}${health.error ? `, health: ${health.error}` : ''}`
    );
  } catch (error) {
    report(false, 'Google Play (gplay)', error.message.split('\n')[0]);
  }

  report(
    Boolean(config.playStatsBucket),
    'Play statistics bucket',
    config.playStatsBucket ?? 'not set: store-listing visitors and installs are skipped (optional)'
  );
  console.log(
    `\nSnapshots: ${path.relative(process.cwd(), SNAPSHOTS_DIR)} (${snapshotDirs().length} so far)`
  );
  process.exitCode = failures > 0 ? 1 : 0;
}

const COMMANDS = {
  check: commandCheck,
  snapshot: commandSnapshot,
  report: commandReport,
  inspect: commandInspect,
  ledger: commandLedger,
};

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const command = COMMANDS[parsed.positional[0]];

  if (!command) {
    console.log(
      'Usage: node scripts/presence.js <check|snapshot|report|inspect|ledger> [options]\n  snapshot [--days 28] [--only gsc,ga4,play,audit,live]\n  report [--snapshot DIR] [--json]\n  inspect <url...>'
    );
    process.exitCode = parsed.positional[0] ? 1 : 0;

    return;
  }

  fs.mkdirSync(PRESENCE_DIR, { recursive: true });
  await command(parsed);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { parseArgs, takeSnapshot };
