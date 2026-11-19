import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type FetchResponse = { ok: boolean; status: number; json: () => Promise<unknown> };
type FetchImpl = jest.Mock<Promise<FetchResponse>, [string, Record<string, unknown>?]>;

type GoogleAuth = {
  SCOPES: Record<string, string>;
  buildAssertion: (key: ServiceKey, scopes: string[], nowMs: number) => string;
  clearTokenCache: () => void;
  describeGoogleError: (status: number, body: unknown, url: string) => string;
  getAccessToken: (
    keyPath: string,
    scopes: string[],
    options?: { fetchImpl?: FetchImpl; nowMs?: number }
  ) => Promise<string>;
  googleJson: (
    url: string,
    options?: { token?: string; method?: string; body?: unknown; fetchImpl?: FetchImpl }
  ) => Promise<any>;
  readServiceAccountKey: (keyPath: string) => ServiceKey;
};

type ServiceKey = { client_email: string; private_key: string; token_uri?: string };

type SearchConsole = {
  chooseSite: (
    sites: { siteUrl: string }[],
    options?: { configured?: string | null; host?: string }
  ) => string | null;
  createSearchConsole: (options: { keyPath: string; fetchImpl?: FetchImpl }) => {
    searchAnalytics: (
      site: string,
      options: Record<string, unknown>
    ) => Promise<Record<string, unknown>[]>;
    inspectUrl: (site: string, url: string) => Promise<Record<string, unknown>>;
  };
  normalizeRow: (dimensions: string[], row: Record<string, unknown>) => Record<string, unknown>;
};

type Analytics = {
  CONVERSION_EVENTS: string[];
  chooseProperty: (
    properties: { property: string; displayName: string; measurementIds: string[] }[],
    measurementId: string
  ) => { property: string } | null;
  createAnalytics: (options: { keyPath: string; propertyId: string; fetchImpl?: FetchImpl }) => {
    report: (options: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
    conversions: (range: {
      startDate: string;
      endDate: string;
    }) => Promise<Record<string, unknown>[]>;
    discoverProperties: () => Promise<
      { property: string; displayName: string; measurementIds: string[] }[]
    >;
  };
};

const googleAuth = require('../presence/googleAuth') as GoogleAuth;
const searchConsole = require('../presence/searchConsole') as SearchConsole;
const analytics = require('../presence/analytics') as Analytics;

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const tmpDirs: string[] = [];

function makeKeyFile(overrides: Partial<ServiceKey> & Record<string, unknown> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'presence-google-test-'));
  tmpDirs.push(dir);
  const file = path.join(dir, 'key.json');
  const key = {
    client_email: 'svc@example-project.iam.gserviceaccount.com',
    private_key: privatePem,
    token_uri: 'https://token.example.test/token',
    ...overrides,
  };
  fs.writeFileSync(file, JSON.stringify(key));
  return file;
}

function response(body: unknown, ok = true, status = 200): FetchResponse {
  return { ok, status, json: async () => body };
}

function tokenResponse(token = 'tok', expiresIn = 3600): FetchResponse {
  return response({ access_token: token, expires_in: expiresIn });
}

function urlOf(call: unknown[]): string {
  return call[0] as string;
}

function bodyOf(call: unknown[]): Record<string, unknown> {
  const init = call[1] as { body: unknown };
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('googleAuth', () => {
  beforeEach(() => {
    googleAuth.clearTokenCache();
  });

  describe('buildAssertion', () => {
    it('signs a verifiable RS256 JWT with the expected claims', () => {
      const key = {
        client_email: 'svc@x.test',
        private_key: privatePem,
        token_uri: 'https://t.test/token',
      };
      const now = 1_700_000_000_000;
      const jwt = googleAuth.buildAssertion(key, ['scopeA', 'scopeB'], now);
      const parts = jwt.split('.');

      expect(parts).toHaveLength(3);
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

      expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
      expect(claims).toEqual({
        iss: 'svc@x.test',
        scope: 'scopeA scopeB',
        aud: 'https://t.test/token',
        iat: 1_700_000_000,
        exp: 1_700_000_000 + 3600,
      });

      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(`${parts[0]}.${parts[1]}`);
      expect(verifier.verify(publicPem, Buffer.from(parts[2], 'base64url'))).toBe(true);
    });
  });

  describe('getAccessToken', () => {
    it('posts a jwt-bearer form and returns the token, caching it until near expiry', async () => {
      const keyPath = makeKeyFile();
      const fetchImpl = jest.fn().mockResolvedValue(tokenResponse('abc', 3600));
      const t0 = 1_700_000_000_000;

      await expect(
        googleAuth.getAccessToken(keyPath, ['s'], { fetchImpl, nowMs: t0 })
      ).resolves.toBe('abc');

      const [url, init] = fetchImpl.mock.calls[0] as [
        string,
        { method: string; body: URLSearchParams },
      ];
      expect(url).toBe('https://token.example.test/token');
      expect(init.method).toBe('POST');
      expect(init.body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
      expect(init.body.get('assertion')).toEqual(expect.any(String));

      await expect(
        googleAuth.getAccessToken(keyPath, ['s'], { fetchImpl, nowMs: t0 + 1000 })
      ).resolves.toBe('abc');
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('refreshes once the cached token is inside the expiry margin', async () => {
      const keyPath = makeKeyFile();
      const fetchImpl = jest
        .fn()
        .mockResolvedValueOnce(tokenResponse('first', 3600))
        .mockResolvedValueOnce(tokenResponse('second', 3600));
      const t0 = 1_700_000_000_000;

      await googleAuth.getAccessToken(keyPath, ['s'], { fetchImpl, nowMs: t0 });
      // Advance past expires_in minus the 60s margin.
      const later = t0 + (3600 - 30) * 1000;

      await expect(
        googleAuth.getAccessToken(keyPath, ['s'], { fetchImpl, nowMs: later })
      ).resolves.toBe('second');
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('rejects with the status and the Google description when sign-in fails', async () => {
      const keyPath = makeKeyFile();
      const fetchImpl = jest
        .fn()
        .mockResolvedValue(
          response({ error: 'invalid_grant', error_description: 'x' }, false, 400)
        );

      await expect(googleAuth.getAccessToken(keyPath, ['s'], { fetchImpl })).rejects.toThrow(
        /400.*x/
      );
    });
  });

  describe('readServiceAccountKey', () => {
    it('throws for a missing file', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'presence-google-test-'));
      tmpDirs.push(dir);

      expect(() => googleAuth.readServiceAccountKey(path.join(dir, 'nope.json'))).toThrow(
        /Cannot read/
      );
    });

    it('throws for JSON without a private_key', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'presence-google-test-'));
      tmpDirs.push(dir);
      const file = path.join(dir, 'key.json');
      fs.writeFileSync(file, JSON.stringify({ client_email: 'a@b.test' }));

      expect(() => googleAuth.readServiceAccountKey(file)).toThrow(/not a service-account key/);
    });
  });

  describe('describeGoogleError', () => {
    it('explains how to grant a 403 access', () => {
      const message = googleAuth.describeGoogleError(
        403,
        { error: { message: 'denied' } },
        'https://api.test'
      );

      expect(message).toContain('denied');
      expect(message).toMatch(/add its email as a user/);
    });

    it('mentions the activation URL when the service is disabled', () => {
      const message = googleAuth.describeGoogleError(
        403,
        {
          error: {
            message: 'off',
            details: [{ reason: 'SERVICE_DISABLED', metadata: { activationUrl: 'https://x' } }],
          },
        },
        'https://api.test'
      );

      expect(message).toContain('https://x');
    });

    it('includes the status and url for other errors', () => {
      const message = googleAuth.describeGoogleError(500, {}, 'https://api.test/thing');

      expect(message).toContain('500');
      expect(message).toContain('https://api.test/thing');
    });
  });

  describe('googleJson', () => {
    it('sends a bearer header and a JSON body with Content-Type for POST', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(response({ ok: 1 }));

      await expect(
        googleAuth.googleJson('https://api.test/x', {
          token: 'tk',
          method: 'POST',
          body: { a: 1 },
          fetchImpl,
        })
      ).resolves.toEqual({ ok: 1 });

      const init = fetchImpl.mock.calls[0][1] as { headers: Record<string, string>; body: string };
      expect(init.headers.Authorization).toBe('Bearer tk');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(init.body)).toEqual({ a: 1 });
    });

    it('sends no body or Content-Type for GET', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(response({}));

      await googleAuth.googleJson('https://api.test/x', { token: 'tk', fetchImpl });

      const init = fetchImpl.mock.calls[0][1] as { headers: Record<string, string>; body: unknown };
      expect(init.headers['Content-Type']).toBeUndefined();
      expect(init.body).toBeUndefined();
    });

    it('rejects with the described error when the response is not ok', async () => {
      const fetchImpl = jest
        .fn()
        .mockResolvedValue(response({ error: { message: 'nope' } }, false, 403));

      await expect(
        googleAuth.googleJson('https://api.test/x', { token: 't', fetchImpl })
      ).rejects.toThrow(/nope.*add its email/);
    });
  });
});

describe('searchConsole', () => {
  beforeEach(() => {
    googleAuth.clearTokenCache();
  });

  describe('normalizeRow', () => {
    it('maps keys onto dimension names and keeps metrics', () => {
      expect(
        searchConsole.normalizeRow(['query', 'page'], {
          keys: ['a', '/b'],
          clicks: 1,
          impressions: 10,
          ctr: 0.1,
          position: 3,
        })
      ).toEqual({ query: 'a', page: '/b', clicks: 1, impressions: 10, ctr: 0.1, position: 3 });
    });
  });

  describe('chooseSite', () => {
    const sites = [{ siteUrl: 'https://musclog.app/' }, { siteUrl: 'sc-domain:musclog.app' }];

    it('uses the configured property first', () => {
      expect(searchConsole.chooseSite(sites, { configured: 'https://other.test/' })).toBe(
        'https://other.test/'
      );
    });

    it('prefers the domain property over the URL prefix', () => {
      expect(searchConsole.chooseSite(sites)).toBe('sc-domain:musclog.app');
    });

    it('falls back to a URL-prefix property when only that exists', () => {
      expect(searchConsole.chooseSite([{ siteUrl: 'https://musclog.app/' }])).toBe(
        'https://musclog.app/'
      );
    });

    it('returns null when no property matches', () => {
      expect(searchConsole.chooseSite([{ siteUrl: 'https://elsewhere.test/' }])).toBeNull();
    });
  });

  describe('createSearchConsole', () => {
    const site = 'https://musclog.app/';
    const encodedSite = encodeURIComponent(site);

    function apiFetch(pages: unknown[][]): FetchImpl {
      const queue = [...pages];
      return jest.fn(async (url: string) => {
        if (url.startsWith('https://oauth2') || url.includes('token')) {
          return tokenResponse();
        }
        return response({ rows: queue.shift() ?? [] });
      }) as unknown as FetchImpl;
    }

    it('posts a web search-analytics query with filters and normalized rows', async () => {
      const keyPath = makeKeyFile();
      const fetchImpl = apiFetch([
        [{ keys: ['running', '/'], clicks: 2, impressions: 20, ctr: 0.1, position: 4 }],
      ]);
      const client = searchConsole.createSearchConsole({ keyPath, fetchImpl });

      const rows = await client.searchAnalytics(site, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        dimensions: ['query', 'page'],
        filters: [{ dimension: 'country', operator: 'equals', expression: 'usa' }],
        maxRows: 100,
      });

      const apiCall = fetchImpl.mock.calls.find((call) => urlOf(call).includes('searchAnalytics'))!;
      expect(urlOf(apiCall)).toContain(encodedSite);
      const body = bodyOf(apiCall);
      expect(body).toMatchObject({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        dimensions: ['query', 'page'],
        dataState: 'final',
        type: 'web',
        rowLimit: 100,
        startRow: 0,
        dimensionFilterGroups: [
          {
            groupType: 'and',
            filters: [{ dimension: 'country', operator: 'equals', expression: 'usa' }],
          },
        ],
      });
      expect(rows).toEqual([
        { query: 'running', page: '/', clicks: 2, impressions: 20, ctr: 0.1, position: 4 },
      ]);
    });

    it('omits dimensionFilterGroups when there are no filters', async () => {
      const keyPath = makeKeyFile();
      const fetchImpl = apiFetch([[]]);
      const client = searchConsole.createSearchConsole({ keyPath, fetchImpl });

      await client.searchAnalytics(site, {
        startDate: 'a',
        endDate: 'b',
        dimensions: ['page'],
        maxRows: 10,
      });

      const apiCall = fetchImpl.mock.calls.find((call) => urlOf(call).includes('searchAnalytics'))!;
      expect(bodyOf(apiCall)).not.toHaveProperty('dimensionFilterGroups');
    });

    it('pages again after a full 25000-row page, then stops on a short one', async () => {
      const keyPath = makeKeyFile();
      const fullPage = Array.from({ length: 25_000 }, (_, i) => ({ keys: [`q${i}`], clicks: 1 }));
      const shortPage = [{ keys: ['last'], clicks: 1 }];
      const fetchImpl = apiFetch([fullPage, shortPage]);
      const client = searchConsole.createSearchConsole({ keyPath, fetchImpl });

      const rows = await client.searchAnalytics(site, {
        startDate: 'a',
        endDate: 'b',
        dimensions: ['query'],
        maxRows: 30_000,
      });

      const apiCalls = fetchImpl.mock.calls.filter((call) =>
        urlOf(call).includes('searchAnalytics')
      );
      expect(apiCalls).toHaveLength(2);
      expect(bodyOf(apiCalls[0])).toMatchObject({ startRow: 0, rowLimit: 25_000 });
      expect(bodyOf(apiCalls[1])).toMatchObject({ startRow: 25_000, rowLimit: 5000 });
      expect(rows).toHaveLength(25_001);
      expect(rows[25_000]).toMatchObject({ query: 'last' });
    });

    it('stops after one request when the first page is short', async () => {
      const keyPath = makeKeyFile();
      const fetchImpl = apiFetch([[{ keys: ['x'], clicks: 1 }]]);
      const client = searchConsole.createSearchConsole({ keyPath, fetchImpl });

      await client.searchAnalytics(site, {
        startDate: 'a',
        endDate: 'b',
        dimensions: ['query'],
        maxRows: 30_000,
      });

      expect(
        fetchImpl.mock.calls.filter((call) => urlOf(call).includes('searchAnalytics'))
      ).toHaveLength(1);
    });

    it('maps the URL inspection result and defaults the verdict to UNKNOWN', async () => {
      const keyPath = makeKeyFile();
      const fetchImpl = jest.fn(async (url: string) => {
        if (url.includes('urlInspection')) {
          return response({
            inspectionResult: {
              indexStatusResult: {
                verdict: 'PASS',
                coverageState: 'Submitted and indexed',
                lastCrawlTime: '2026-01-02T00:00:00Z',
                googleCanonical: 'https://musclog.app/a',
              },
            },
          });
        }
        return tokenResponse();
      }) as unknown as FetchImpl;
      const client = searchConsole.createSearchConsole({ keyPath, fetchImpl });

      const result = await client.inspectUrl('sc-domain:musclog.app', 'https://musclog.app/a');
      expect(result).toMatchObject({
        url: 'https://musclog.app/a',
        verdict: 'PASS',
        coverageState: 'Submitted and indexed',
        lastCrawlTime: '2026-01-02T00:00:00Z',
        googleCanonical: 'https://musclog.app/a',
        sitemaps: [],
      });

      const empty = jest.fn(async (url: string) =>
        url.includes('urlInspection') ? response({ inspectionResult: {} }) : tokenResponse()
      ) as unknown as FetchImpl;
      const bare = searchConsole.createSearchConsole({ keyPath, fetchImpl: empty });
      await expect(
        bare.inspectUrl('sc-domain:musclog.app', 'https://musclog.app/b')
      ).resolves.toMatchObject({
        verdict: 'UNKNOWN',
        coverageState: null,
      });
    });
  });
});

describe('analytics', () => {
  beforeEach(() => {
    googleAuth.clearTokenCache();
  });

  describe('chooseProperty', () => {
    const properties = [
      { property: '1', displayName: 'One', measurementIds: ['G-AAA'] },
      { property: '2', displayName: 'Two', measurementIds: ['G-BBB', 'G-CCC'] },
    ];

    it('picks the property whose stream carries the measurement id', () => {
      expect(analytics.chooseProperty(properties, 'G-CCC')).toEqual(properties[1]);
    });

    it('returns null when no property carries it', () => {
      expect(analytics.chooseProperty(properties, 'G-ZZZ')).toBeNull();
    });
  });

  describe('createAnalytics', () => {
    const range = { startDate: '2026-01-01', endDate: '2026-01-31' };

    it('posts a runReport and maps rows to dimension strings and numeric metrics', async () => {
      const keyPath = makeKeyFile();
      const fetchImpl = jest.fn(async (url: string) =>
        url.includes('runReport')
          ? response({
              rows: [
                {
                  dimensionValues: [{ value: '/' }],
                  metricValues: [{ value: '42' }, { value: '7' }],
                },
              ],
            })
          : tokenResponse()
      ) as unknown as FetchImpl;
      const client = analytics.createAnalytics({ keyPath, propertyId: '123', fetchImpl });

      const rows = await client.report({
        ...range,
        dimensions: ['landingPage'],
        metrics: ['sessions', 'engagedSessions'],
        orderBy: 'sessions',
        limit: 50,
        filter: { filter: { fieldName: 'x' } },
      });

      const call = fetchImpl.mock.calls.find((c) => urlOf(c).includes('runReport'))!;
      expect(urlOf(call)).toBe(
        'https://analyticsdata.googleapis.com/v1beta/properties/123:runReport'
      );
      expect(bodyOf(call)).toEqual({
        dateRanges: [range],
        dimensions: [{ name: 'landingPage' }],
        metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }],
        limit: 50,
        dimensionFilter: { filter: { fieldName: 'x' } },
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      });
      expect(rows).toEqual([{ landingPage: '/', sessions: 42, engagedSessions: 7 }]);
    });

    it('omits dimensionFilter and orderBys when not given', async () => {
      const keyPath = makeKeyFile();
      const fetchImpl = jest.fn(async (url: string) =>
        url.includes('runReport') ? response({}) : tokenResponse()
      ) as unknown as FetchImpl;
      const client = analytics.createAnalytics({ keyPath, propertyId: '9', fetchImpl });

      await expect(
        client.report({ ...range, dimensions: ['country'], metrics: ['sessions'] })
      ).resolves.toEqual([]);

      const call = fetchImpl.mock.calls.find((c) => urlOf(c).includes('runReport'))!;
      expect(bodyOf(call)).not.toHaveProperty('dimensionFilter');
      expect(bodyOf(call)).not.toHaveProperty('orderBys');
    });

    it('conversions() filters on the store-button and demo-start events', async () => {
      const keyPath = makeKeyFile();
      const fetchImpl = jest.fn(async (url: string) =>
        url.includes('runReport') ? response({ rows: [] }) : tokenResponse()
      ) as unknown as FetchImpl;
      const client = analytics.createAnalytics({ keyPath, propertyId: '123', fetchImpl });

      await client.conversions(range);

      const call = fetchImpl.mock.calls.find((c) => urlOf(c).includes('runReport'))!;
      const filter = bodyOf(call).dimensionFilter as {
        filter: { fieldName: string; inListFilter: { values: string[] } };
      };
      expect(filter.filter.fieldName).toBe('eventName');
      expect(filter.filter.inListFilter.values).toEqual(
        expect.arrayContaining(['store_button_click', 'demo_start'])
      );
      expect(analytics.CONVERSION_EVENTS).toEqual(filter.filter.inListFilter.values);
    });

    it('discoverProperties walks account summaries and data streams, stripping the property prefix', async () => {
      const keyPath = makeKeyFile();
      const fetchImpl = jest.fn(async (url: string) => {
        if (url.includes('accountSummaries')) {
          return response({
            accountSummaries: [
              { propertySummaries: [{ property: 'properties/123', displayName: 'Musclog' }] },
            ],
          });
        }
        if (url.includes('dataStreams')) {
          return response({
            dataStreams: [{ webStreamData: { measurementId: 'G-ABC' } }, { iosAppStreamData: {} }],
          });
        }
        return tokenResponse();
      }) as unknown as FetchImpl;
      const client = analytics.createAnalytics({ keyPath, propertyId: '123', fetchImpl });

      await expect(client.discoverProperties()).resolves.toEqual([
        { property: '123', displayName: 'Musclog', measurementIds: ['G-ABC'] },
      ]);
    });

    it('yields empty measurementIds when the dataStreams call fails', async () => {
      const keyPath = makeKeyFile();
      const fetchImpl = jest.fn(async (url: string) => {
        if (url.includes('accountSummaries')) {
          return response({
            accountSummaries: [
              { propertySummaries: [{ property: 'properties/5', displayName: 'Five' }] },
            ],
          });
        }
        if (url.includes('dataStreams')) {
          return response({ error: { message: 'denied' } }, false, 403);
        }
        return tokenResponse();
      }) as unknown as FetchImpl;
      const client = analytics.createAnalytics({ keyPath, propertyId: '5', fetchImpl });

      await expect(client.discoverProperties()).resolves.toEqual([
        { property: '5', displayName: 'Five', measurementIds: [] },
      ]);
    });
  });
});
