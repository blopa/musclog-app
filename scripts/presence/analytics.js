/**
 * Google Analytics 4 client (read-only): the Data API reports the website needs, and property
 * discovery through the Admin API (matches the site's measurement id to a numeric property id).
 *
 * The site only sends analytics after the visitor accepts the consent banner
 * (utils/websiteAnalytics.web.ts), so every number here undercounts: read GA4 for the shape of
 * traffic (sources, landing pages, store-button clicks), never as a visitor total. Search Console is
 * the count that does not depend on consent.
 */
const { SCOPES, getAccessToken, googleJson } = require('./googleAuth');

const DATA_API = 'https://analyticsdata.googleapis.com/v1beta';
const ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta';

// The events utils/websiteAnalytics.web.ts sends that mean a visitor moved toward the app.
const CONVERSION_EVENTS = ['store_button_click', 'demo_start'];

function createAnalytics({ keyPath, propertyId, fetchImpl = fetch }) {
  const request = async (url, options = {}) => {
    const token = await getAccessToken(keyPath, [SCOPES.analytics], { fetchImpl });

    return googleJson(url, { token, fetchImpl, ...options });
  };

  /** Generic runReport that returns `[{ dimensionName: value, metricName: number }]`. */
  const report = async ({
    dimensions,
    metrics,
    startDate,
    endDate,
    filter,
    orderBy,
    limit = 1000,
  }) => {
    const payload = await request(`${DATA_API}/properties/${propertyId}:runReport`, {
      method: 'POST',
      body: {
        dateRanges: [{ startDate, endDate }],
        dimensions: dimensions.map((name) => ({ name })),
        metrics: metrics.map((name) => ({ name })),
        limit,
        ...(filter ? { dimensionFilter: filter } : {}),
        ...(orderBy ? { orderBys: [{ metric: { metricName: orderBy }, desc: true }] } : {}),
      },
    });

    return (payload.rows ?? []).map((row) => {
      const out = {};

      dimensions.forEach((name, index) => {
        out[name] = row.dimensionValues?.[index]?.value ?? '';
      });
      metrics.forEach((name, index) => {
        out[name] = Number(row.metricValues?.[index]?.value ?? 0);
      });

      return out;
    });
  };

  return {
    report,

    landingPages: (range) =>
      report({
        ...range,
        dimensions: ['landingPage'],
        metrics: ['sessions', 'engagedSessions', 'engagementRate', 'averageSessionDuration'],
        orderBy: 'sessions',
      }),

    sources: (range) =>
      report({
        ...range,
        dimensions: [
          'sessionDefaultChannelGroup',
          'sessionSource',
          'sessionMedium',
          'sessionCampaignName',
        ],
        metrics: ['sessions', 'engagedSessions', 'engagementRate'],
        orderBy: 'sessions',
      }),

    countries: (range) =>
      report({
        ...range,
        dimensions: ['country'],
        metrics: ['sessions', 'engagedSessions'],
        orderBy: 'sessions',
      }),

    devices: (range) =>
      report({
        ...range,
        dimensions: ['deviceCategory'],
        metrics: ['sessions', 'engagedSessions'],
        orderBy: 'sessions',
      }),

    daily: (range) =>
      report({
        ...range,
        dimensions: ['date'],
        metrics: ['sessions', 'engagedSessions'],
        limit: 400,
      }),

    /** Where store-button clicks and demo starts happen: `{ eventName, pagePath, eventCount }`. */
    conversions: (range) =>
      report({
        ...range,
        dimensions: ['eventName', 'pagePath'],
        metrics: ['eventCount'],
        filter: {
          filter: { fieldName: 'eventName', inListFilter: { values: CONVERSION_EVENTS } },
        },
        orderBy: 'eventCount',
      }),

    /** Every property the account can read, with its web streams' measurement ids. */
    async discoverProperties() {
      const summaries = await request(`${ADMIN_API}/accountSummaries?pageSize=200`);
      const found = [];

      for (const account of summaries.accountSummaries ?? []) {
        for (const property of account.propertySummaries ?? []) {
          const streams = await request(`${ADMIN_API}/${property.property}/dataStreams`).catch(
            () => ({})
          );

          found.push({
            property: property.property.replace(/^properties\//, ''),
            displayName: property.displayName,
            measurementIds: (streams.dataStreams ?? [])
              .map((stream) => stream.webStreamData?.measurementId)
              .filter(Boolean),
          });
        }
      }

      return found;
    },
  };
}

/** The property whose web stream carries this measurement id, or null. */
function chooseProperty(properties, measurementId) {
  return properties.find((entry) => entry.measurementIds.includes(measurementId)) ?? null;
}

module.exports = { CONVERSION_EVENTS, chooseProperty, createAnalytics };
