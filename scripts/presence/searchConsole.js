/**
 * Google Search Console client (read-only): the sites the account can see, sitemap status, search
 * analytics and URL inspection. Rows are normalized to plain objects keyed by dimension name so the
 * pure analysis in analysis.js never sees Google's `keys: []` shape.
 */
const { SCOPES, getAccessToken, googleJson } = require('./googleAuth');

const WEBMASTERS = 'https://www.googleapis.com/webmasters/v3';
const INSPECTION = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';
const ROWS_PER_REQUEST = 25_000;
const DEFAULT_MAX_ROWS = 50_000;

function siteUrlPath(site) {
  return encodeURIComponent(site);
}

/** `["query","page"]` + `{keys:["x","/y"], clicks…}` -> `{query:"x", page:"/y", clicks…}`. */
function normalizeRow(dimensions, row) {
  const out = {
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  };

  dimensions.forEach((dimension, index) => {
    out[dimension] = row.keys?.[index] ?? '';
  });

  return out;
}

function createSearchConsole({ keyPath, fetchImpl = fetch }) {
  const request = async (url, options = {}) => {
    const token = await getAccessToken(keyPath, [SCOPES.searchConsole], { fetchImpl });

    return googleJson(url, { token, fetchImpl, ...options });
  };

  return {
    /** Sites this service account can read: `[{ siteUrl, permissionLevel }]`. */
    async listSites() {
      const payload = await request(`${WEBMASTERS}/sites`);

      return payload.siteEntry ?? [];
    },

    async listSitemaps(site) {
      const payload = await request(`${WEBMASTERS}/sites/${siteUrlPath(site)}/sitemaps`);

      return payload.sitemap ?? [];
    },

    /**
     * One search-analytics query, paged until Google returns a short page or `maxRows` is reached.
     * `filters` is an array of `{ dimension, operator, expression }` (AND-ed).
     */
    async searchAnalytics(
      site,
      {
        startDate,
        endDate,
        dimensions,
        filters = [],
        maxRows = DEFAULT_MAX_ROWS,
        searchType = 'web',
      }
    ) {
      const rows = [];

      for (let startRow = 0; startRow < maxRows; startRow += ROWS_PER_REQUEST) {
        const payload = await request(
          `${WEBMASTERS}/sites/${siteUrlPath(site)}/searchAnalytics/query`,
          {
            method: 'POST',
            body: {
              startDate,
              endDate,
              dimensions,
              type: searchType,
              dataState: 'final',
              rowLimit: Math.min(ROWS_PER_REQUEST, maxRows - startRow),
              startRow,
              ...(filters.length > 0
                ? { dimensionFilterGroups: [{ groupType: 'and', filters }] }
                : {}),
            },
          }
        );
        const page = payload.rows ?? [];

        rows.push(...page.map((row) => normalizeRow(dimensions, row)));

        if (page.length < ROWS_PER_REQUEST) {
          break;
        }
      }

      return rows;
    },

    /** Google's own verdict for one URL: indexed or not, why, canonical, last crawl. */
    async inspectUrl(site, inspectionUrl) {
      const payload = await request(INSPECTION, {
        method: 'POST',
        body: { inspectionUrl, siteUrl: site, languageCode: 'en-US' },
      });
      const result = payload.inspectionResult ?? {};
      const index = result.indexStatusResult ?? {};

      return {
        url: inspectionUrl,
        verdict: index.verdict ?? 'UNKNOWN',
        coverageState: index.coverageState ?? null,
        indexingState: index.indexingState ?? null,
        robotsTxtState: index.robotsTxtState ?? null,
        pageFetchState: index.pageFetchState ?? null,
        lastCrawlTime: index.lastCrawlTime ?? null,
        googleCanonical: index.googleCanonical ?? null,
        userCanonical: index.userCanonical ?? null,
        sitemaps: index.sitemap ?? [],
        mobileUsability: result.mobileUsabilityResult?.verdict ?? null,
      };
    },
  };
}

/**
 * Picks the property to use. An explicit config wins; otherwise a domain property
 * (`sc-domain:musclog.app`) beats the URL-prefix one, because it covers every protocol and subdomain.
 */
function chooseSite(sites, { configured = null, host = 'musclog.app' } = {}) {
  if (configured) {
    return configured;
  }

  const urls = sites.map((entry) => entry.siteUrl);

  return (
    urls.find((url) => url === `sc-domain:${host}`) ??
    urls.find((url) => url.replace(/\/$/, '').endsWith(host)) ??
    null
  );
}

module.exports = { chooseSite, createSearchConsole, normalizeRow };
