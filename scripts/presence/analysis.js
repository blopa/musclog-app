/**
 * Pure analysis over normalized Search Console rows (`{ query, page, clicks, impressions, ctr,
 * position }`). No I/O, no clock: every function is a table-in, table-out rule, so the thresholds are
 * the product decisions and each is covered by a test.
 *
 * The CTR curve and the thresholds are rough heuristics, not measurements of this site: they decide
 * what is worth LOOKING at, never what to change. The skill reads the page before it proposes an edit.
 */

// Typical organic CTR by average position 1..10 (rounded from public industry studies). Beyond 10
// the page is on page two or lower and the curve is flat and small.
const CTR_BY_POSITION = [0.28, 0.15, 0.1, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.018];
const CTR_BEYOND_PAGE_ONE = 0.008;

function expectedCtr(position) {
  if (!Number.isFinite(position) || position < 1) {
    return CTR_BY_POSITION[0];
  }

  return position > 10 ? CTR_BEYOND_PAGE_ONE : CTR_BY_POSITION[Math.round(position) - 1];
}

/** Sums rows sharing `keyFn`; position is averaged weighted by impressions, as Search Console does. */
function groupRows(rows, keyFn) {
  const groups = new Map();

  for (const row of rows) {
    const key = keyFn(row);
    const entry = groups.get(key) ?? { key, clicks: 0, impressions: 0, positionWeight: 0 };

    entry.clicks += row.clicks;
    entry.impressions += row.impressions;
    entry.positionWeight += row.position * row.impressions;
    groups.set(key, entry);
  }

  return [...groups.values()].map((entry) => ({
    key: entry.key,
    clicks: entry.clicks,
    impressions: entry.impressions,
    ctr: entry.impressions > 0 ? entry.clicks / entry.impressions : 0,
    position: entry.impressions > 0 ? entry.positionWeight / entry.impressions : 0,
  }));
}

function totals(rows) {
  const [sum] = groupRows(rows, () => 'all');

  return sum ?? { key: 'all', clicks: 0, impressions: 0, ctr: 0, position: 0 };
}

/** Path of a page URL, so reports stay short and a ledger row can name `/blog/x` instead of a URL. */
function pagePath(url) {
  try {
    const parsed = new URL(url);

    return `${parsed.pathname}${parsed.search}` || '/';
  } catch {
    return url;
  }
}

/**
 * Queries that already show on page one but earn fewer clicks than their position predicts: the title
 * or description is not winning the click. Sorted by the clicks left on the table.
 */
function findLowCtr(rows, { minImpressions = 50, maxPosition = 10, shortfallRatio = 0.5 } = {}) {
  return rows
    .filter((row) => row.impressions >= minImpressions && row.position <= maxPosition)
    .map((row) => {
      const expected = expectedCtr(row.position);

      return {
        ...row,
        expectedCtr: expected,
        missedClicks: Math.max(0, (expected - row.ctr) * row.impressions),
      };
    })
    .filter((row) => row.ctr < expectedCtr(row.position) * shortfallRatio)
    .sort((a, b) => b.missedClicks - a.missedClicks);
}

/** Queries ranking just off page one: a better page or a link or two can move them over the line. */
function findStrikingDistance(
  rows,
  { minImpressions = 30, minPosition = 8, maxPosition = 20 } = {}
) {
  return rows
    .filter(
      (row) =>
        row.impressions >= minImpressions &&
        row.position >= minPosition &&
        row.position <= maxPosition
    )
    .sort((a, b) => b.impressions - a.impressions);
}

/**
 * Queries answered by several of our own pages, none clearly ahead. Takes query×page rows. Only
 * queries where the second page holds at least `minSecondShare` of the impressions are reported.
 */
function findCannibalization(queryPageRows, { minImpressions = 40, minSecondShare = 0.2 } = {}) {
  const byQuery = new Map();

  for (const row of queryPageRows) {
    const list = byQuery.get(row.query) ?? [];

    list.push(row);
    byQuery.set(row.query, list);
  }

  const findings = [];

  for (const [query, list] of byQuery) {
    const impressions = list.reduce((sum, row) => sum + row.impressions, 0);

    if (list.length < 2 || impressions < minImpressions) {
      continue;
    }

    const pages = [...list].sort((a, b) => b.impressions - a.impressions);

    if (pages[1].impressions / impressions >= minSecondShare) {
      findings.push({
        query,
        impressions,
        pages: pages.map((row) => ({
          page: pagePath(row.page),
          clicks: row.clicks,
          impressions: row.impressions,
          position: row.position,
        })),
      });
    }
  }

  return findings.sort((a, b) => b.impressions - a.impressions);
}

// Question openers in the five app languages: the people asking are the ones a how-to post helps.
const QUESTION_OPENERS = new RegExp(
  `^(${[
    'how',
    'what',
    'why',
    'when',
    'which',
    'does',
    'do',
    'is',
    'can',
    'should',
    'cómo',
    'como',
    'qué',
    'que',
    'cuánto',
    'cuanto',
    'por qué',
    'hoe',
    'wat',
    'waarom',
    'welke',
    'wanneer',
    'quanto',
    'quantas',
    'quantos',
    'qual',
    'как',
    'что',
    'сколько',
    'почему',
    'какой',
    'какие',
  ].join('|')})\\s`,
  'iu'
);

/** Queries phrased as questions, the raw material for how-to posts. */
function findQuestionQueries(rows, { minImpressions = 5 } = {}) {
  return rows
    .filter((row) => row.impressions >= minImpressions && QUESTION_OPENERS.test(row.query.trim()))
    .sort((a, b) => b.impressions - a.impressions);
}

/**
 * Current vs previous period for the same key. `previous` rows missing from `current` come back with
 * zeros, so a page that stopped appearing is a mover, not invisible.
 */
function compareGroups(currentRows, previousRows, keyFn) {
  const current = new Map(groupRows(currentRows, keyFn).map((entry) => [entry.key, entry]));
  const previous = new Map(groupRows(previousRows, keyFn).map((entry) => [entry.key, entry]));
  const keys = new Set([...current.keys(), ...previous.keys()]);

  return [...keys].map((key) => {
    const now = current.get(key) ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    const before = previous.get(key) ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };

    return {
      key,
      clicks: now.clicks,
      impressions: now.impressions,
      ctr: now.ctr,
      position: now.position,
      previousClicks: before.clicks,
      previousImpressions: before.impressions,
      previousPosition: before.position,
      clicksDelta: now.clicks - before.clicks,
      impressionsDelta: now.impressions - before.impressions,
      // Negative = moved up. Only meaningful when both periods had impressions.
      positionDelta:
        now.impressions > 0 && before.impressions > 0 ? now.position - before.position : null,
    };
  });
}

/** The biggest gainers and losers by clicks (impressions break ties), ignoring tiny noise. */
function findMovers(comparison, { minChange = 3, limit = 10 } = {}) {
  const material = comparison.filter(
    (entry) =>
      Math.abs(entry.clicksDelta) >= minChange || Math.abs(entry.impressionsDelta) >= minChange * 10
  );
  const byChange = (a, b) =>
    b.clicksDelta - a.clicksDelta || b.impressionsDelta - a.impressionsDelta;

  return {
    gainers: material
      .filter((entry) => entry.clicksDelta > 0 || entry.impressionsDelta > 0)
      .sort(byChange)
      .slice(0, limit),
    losers: material
      .filter((entry) => entry.clicksDelta < 0 || entry.impressionsDelta < 0)
      .sort((a, b) => byChange(b, a))
      .slice(0, limit),
  };
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);

    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '') || '/'}`;
  } catch {
    return url;
  }
}

/** Sitemap URLs that got no impressions at all in the window: not indexed, or not ranking for anything. */
function findUnseenUrls(sitemapUrls, pageRows) {
  const seen = new Set(
    pageRows.filter((row) => row.impressions > 0).map((row) => normalizeUrl(row.page))
  );

  return sitemapUrls.filter((url) => !seen.has(normalizeUrl(url)));
}

/** Ranked pages (by clicks, then impressions) with their best queries, for a "what works" list. */
function topPagesWithQueries(queryPageRows, { pages = 10, queriesPerPage = 3 } = {}) {
  const byPage = groupRows(queryPageRows, (row) => row.page).sort(
    (a, b) => b.clicks - a.clicks || b.impressions - a.impressions
  );

  return byPage.slice(0, pages).map((entry) => ({
    page: pagePath(entry.key),
    clicks: entry.clicks,
    impressions: entry.impressions,
    ctr: entry.ctr,
    position: entry.position,
    queries: queryPageRows
      .filter((row) => row.page === entry.key)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, queriesPerPage)
      .map((row) => row.query),
  }));
}

/**
 * Clicks and impressions per country, so an app language with traffic but a thin site (or the other
 * way round) shows up. Country codes from Search Console are lower-case ISO-3166 alpha-3.
 */
function byCountry(rows, { limit = 10 } = {}) {
  return groupRows(rows, (row) => row.country)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);
}

/** GA4 landing pages that get visits but few engaged sessions: the page does not deliver what it promised. */
function findWeakLandingPages(rows, { minSessions = 20, maxEngagementRate = 0.4 } = {}) {
  return rows
    .filter((row) => row.sessions >= minSessions && row.engagementRate <= maxEngagementRate)
    .sort((a, b) => b.sessions - a.sessions);
}

/** Pages ranked by store-button clicks per GA4 conversion row, joined with their sessions when known. */
function conversionByPage(conversionRows, landingRows) {
  const sessions = new Map(landingRows.map((row) => [row.landingPage.split('?')[0], row.sessions]));
  const byPath = new Map();

  for (const row of conversionRows) {
    const key = row.pagePath.split('?')[0];
    const entry = byPath.get(key) ?? { page: key, storeClicks: 0, demoStarts: 0 };

    if (row.eventName === 'store_button_click') {
      entry.storeClicks += row.eventCount;
    } else if (row.eventName === 'demo_start') {
      entry.demoStarts += row.eventCount;
    }

    byPath.set(key, entry);
  }

  return [...byPath.values()]
    .map((entry) => {
      const pageSessions = sessions.get(entry.page) ?? null;

      return {
        ...entry,
        sessions: pageSessions,
        storeClickRate: pageSessions ? entry.storeClicks / pageSessions : null,
      };
    })
    .sort((a, b) => b.storeClicks + b.demoStarts - (a.storeClicks + a.demoStarts));
}

module.exports = {
  byCountry,
  compareGroups,
  conversionByPage,
  expectedCtr,
  findCannibalization,
  findLowCtr,
  findMovers,
  findQuestionQueries,
  findStrikingDistance,
  findUnseenUrls,
  findWeakLandingPages,
  groupRows,
  normalizeUrl,
  pagePath,
  topPagesWithQueries,
  totals,
};
