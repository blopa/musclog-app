const analysis = require('../presence/analysis') as {
  byCountry: (rows: QueryRow[], options?: { limit?: number }) => GroupEntry[];
  compareGroups: (
    current: QueryRow[],
    previous: QueryRow[],
    keyFn: (row: QueryRow) => string
  ) => Comparison[];
  conversionByPage: (
    conversionRows: ConversionRow[],
    landingRows: LandingRow[]
  ) => ConversionPage[];
  expectedCtr: (position: number) => number;
  findCannibalization: (
    rows: QueryRow[],
    options?: { minImpressions?: number; minSecondShare?: number }
  ) => Cannibalization[];
  findLowCtr: (
    rows: QueryRow[],
    options?: { minImpressions?: number; maxPosition?: number; shortfallRatio?: number }
  ) => Array<QueryRow & { expectedCtr: number; missedClicks: number }>;
  findMovers: (
    comparison: Array<{ key: string; clicksDelta: number; impressionsDelta: number }>,
    options?: { minChange?: number; limit?: number }
  ) => { gainers: Array<{ key: string }>; losers: Array<{ key: string }> };
  findQuestionQueries: (rows: QueryRow[], options?: { minImpressions?: number }) => QueryRow[];
  findStrikingDistance: (
    rows: QueryRow[],
    options?: { minImpressions?: number; minPosition?: number; maxPosition?: number }
  ) => QueryRow[];
  findUnseenUrls: (sitemapUrls: string[], pageRows: QueryRow[]) => string[];
  findWeakLandingPages: (
    rows: LandingRow[],
    options?: { minSessions?: number; maxEngagementRate?: number }
  ) => LandingRow[];
  groupRows: (rows: QueryRow[], keyFn: (row: QueryRow) => string) => GroupEntry[];
  normalizeUrl: (url: string) => string;
  pagePath: (url: string) => string;
  topPagesWithQueries: (
    rows: QueryRow[],
    options?: { pages?: number; queriesPerPage?: number }
  ) => Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    queries: string[];
  }>;
  totals: (rows: QueryRow[]) => GroupEntry;
};

type QueryRow = {
  query: string;
  page: string;
  country: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type GroupEntry = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type Comparison = GroupEntry & {
  previousClicks: number;
  previousImpressions: number;
  previousPosition: number;
  clicksDelta: number;
  impressionsDelta: number;
  positionDelta: number | null;
};

type Cannibalization = {
  query: string;
  impressions: number;
  pages: Array<{ page: string; clicks: number; impressions: number; position: number }>;
};

type LandingRow = { landingPage: string; sessions: number; engagementRate: number };

type ConversionRow = { eventName: string; pagePath: string; eventCount: number };

type ConversionPage = {
  page: string;
  storeClicks: number;
  demoStarts: number;
  sessions: number | null;
  storeClickRate: number | null;
};

function row(
  query: string,
  page: string,
  clicks: number,
  impressions: number,
  position: number,
  country = 'usa'
): QueryRow {
  return {
    query,
    page,
    country,
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position,
  };
}

const SITE = 'https://musclog.app';

describe('presence analysis', () => {
  describe('expectedCtr', () => {
    it('follows the CTR curve by average position', () => {
      expect(analysis.expectedCtr(1)).toBe(0.28);
      expect(analysis.expectedCtr(3)).toBe(0.1);
      expect(analysis.expectedCtr(10)).toBeCloseTo(0.018);
      expect(analysis.expectedCtr(25)).toBeCloseTo(0.008);
    });

    it('treats a missing or zero position as the top of the curve', () => {
      expect(analysis.expectedCtr(Number.NaN)).toBe(0.28);
      expect(analysis.expectedCtr(0)).toBe(0.28);
    });
  });

  describe('groupRows and totals', () => {
    const rows = [row('a', `${SITE}/x`, 2, 100, 2), row('a', `${SITE}/y`, 3, 300, 8)];

    it('sums clicks and impressions and weights position by impressions', () => {
      const [group] = analysis.groupRows(rows, (r) => r.query);

      expect(group.key).toBe('a');
      expect(group.clicks).toBe(5);
      expect(group.impressions).toBe(400);
      expect(group.ctr).toBeCloseTo(5 / 400);
      expect(group.position).toBeCloseTo(6.5);
    });

    it('totals rows and returns zeros for no rows', () => {
      const sum = analysis.totals(rows);

      expect(sum.clicks).toBe(5);
      expect(sum.impressions).toBe(400);
      expect(sum.position).toBeCloseTo(6.5);

      expect(analysis.totals([])).toEqual({
        key: 'all',
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
      });
    });
  });

  describe('pagePath', () => {
    it('keeps the path and query of a full URL', () => {
      expect(analysis.pagePath(`${SITE}/blog/x?y=1`)).toBe('/blog/x?y=1');
    });

    it('maps the bare origin to /', () => {
      expect(analysis.pagePath(SITE)).toBe('/');
    });

    it('returns a non-URL string unchanged', () => {
      expect(analysis.pagePath('not a url')).toBe('not a url');
    });
  });

  describe('findLowCtr', () => {
    it('keeps page-one queries earning under half the expected CTR, by missed clicks', () => {
      const rows = [
        row('low', `${SITE}/a`, 1, 100, 1),
        row('low2', `${SITE}/b`, 0, 200, 3),
        row('tiny', `${SITE}/c`, 0, 10, 1),
        row('deep', `${SITE}/d`, 0, 500, 12),
        row('healthy', `${SITE}/e`, 30, 100, 1),
      ];

      const result = analysis.findLowCtr(rows);

      expect(result.map((r) => r.query)).toEqual(['low', 'low2']);
      expect(result[0].expectedCtr).toBe(0.28);
      expect(result[0].missedClicks).toBeCloseTo(27);
      expect(result[1].missedClicks).toBeCloseTo(20);
    });
  });

  describe('findStrikingDistance', () => {
    it('keeps positions 8 to 20 with enough impressions, by impressions', () => {
      const rows = [
        row('b', `${SITE}/b`, 0, 50, 20),
        row('a', `${SITE}/a`, 0, 100, 8),
        row('above', `${SITE}/c`, 0, 500, 7.9),
        row('few', `${SITE}/d`, 0, 10, 9),
        row('beyond', `${SITE}/e`, 0, 900, 21),
      ];

      expect(analysis.findStrikingDistance(rows).map((r) => r.query)).toEqual(['a', 'b']);
    });
  });

  describe('findCannibalization', () => {
    it('reports a query whose second page holds at least 20% of impressions', () => {
      const rows = [
        row('split', `${SITE}/blog/b`, 1, 40, 5),
        row('split', `${SITE}/blog/a`, 2, 60, 4),
        row('one', `${SITE}/blog/c`, 5, 500, 3),
        row('dominant', `${SITE}/x`, 5, 90, 2),
        row('dominant', `${SITE}/y`, 0, 10, 6),
        row('small', `${SITE}/p`, 0, 20, 2),
        row('small', `${SITE}/q`, 0, 19, 2),
      ];

      const result = analysis.findCannibalization(rows);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe('split');
      expect(result[0].impressions).toBe(100);
      expect(result[0].pages.map((p) => p.page)).toEqual(['/blog/a', '/blog/b']);
    });
  });

  describe('findQuestionQueries', () => {
    it('matches English, Spanish, Russian and Dutch question openers', () => {
      const rows = [
        row('how much protein', SITE, 0, 30, 5),
        row('cómo calcular 1rm', SITE, 0, 20, 5),
        row('как считать 1rm', SITE, 0, 15, 5),
        row('hoe veel eiwit', SITE, 0, 10, 5),
        row('plate calculator', SITE, 0, 100, 5),
        row('how many sets', SITE, 0, 4, 5),
      ];

      expect(analysis.findQuestionQueries(rows).map((r) => r.query)).toEqual([
        'how much protein',
        'cómo calcular 1rm',
        'как считать 1rm',
        'hoe veel eiwit',
      ]);
    });
  });

  describe('compareGroups', () => {
    const current = [row('a', SITE, 10, 100, 4), row('b', SITE, 5, 50, 2)];
    const previous = [row('a', SITE, 4, 80, 6), row('c', SITE, 3, 30, 9)];

    it('computes deltas for keys in both periods and null position delta without impressions', () => {
      const comparison = analysis.compareGroups(current, previous, (r) => r.query);
      const byKey = new Map(comparison.map((entry) => [entry.key, entry]));

      const a = byKey.get('a');
      expect(a?.clicksDelta).toBe(6);
      expect(a?.impressionsDelta).toBe(20);
      expect(a?.positionDelta).toBe(-2);
    });

    it('returns keys only in the previous period with zeros and a negative delta', () => {
      const comparison = analysis.compareGroups(current, previous, (r) => r.query);
      const c = comparison.find((entry) => entry.key === 'c');

      expect(c?.clicks).toBe(0);
      expect(c?.impressions).toBe(0);
      expect(c?.clicksDelta).toBe(-3);
      expect(c?.positionDelta).toBeNull();
    });

    it('returns a null position delta for a key that is new this period', () => {
      const comparison = analysis.compareGroups(current, previous, (r) => r.query);
      const b = comparison.find((entry) => entry.key === 'b');

      expect(b?.previousImpressions).toBe(0);
      expect(b?.clicksDelta).toBe(5);
      expect(b?.positionDelta).toBeNull();
    });
  });

  describe('findMovers', () => {
    const comparison = [
      { key: 'noise', clicksDelta: 2, impressionsDelta: 29 },
      { key: 'gainA', clicksDelta: 5, impressionsDelta: 0 },
      { key: 'gainB', clicksDelta: 3, impressionsDelta: 10 },
      { key: 'impOnly', clicksDelta: 0, impressionsDelta: 30 },
      { key: 'lossA', clicksDelta: -4, impressionsDelta: -5 },
      { key: 'lossB', clicksDelta: -3, impressionsDelta: 0 },
    ];

    it('ignores changes below the minimum and splits gainers from losers', () => {
      const { gainers, losers } = analysis.findMovers(comparison);

      expect(gainers.map((e) => e.key)).toEqual(['gainA', 'gainB', 'impOnly']);
      expect(losers.map((e) => e.key)).toEqual(['lossA', 'lossB']);
    });

    it('respects the limit', () => {
      const { gainers, losers } = analysis.findMovers(comparison, { limit: 1 });

      expect(gainers.map((e) => e.key)).toEqual(['gainA']);
      expect(losers.map((e) => e.key)).toEqual(['lossA']);
    });
  });

  describe('normalizeUrl and findUnseenUrls', () => {
    it('ignores a trailing slash and query string', () => {
      expect(analysis.normalizeUrl(`${SITE}/blog/`)).toBe(analysis.normalizeUrl(`${SITE}/blog`));
      expect(analysis.normalizeUrl(`${SITE}/blog?utm=1`)).toBe(`${SITE}/blog`);
    });

    it('reports sitemap URLs with no row or only zero-impression rows', () => {
      const sitemap = [
        `${SITE}/blog/`,
        `${SITE}/tools/x`,
        `${SITE}/programs/y`,
        `${SITE}/exercises`,
      ];
      const pageRows = [
        row('', `${SITE}/blog`, 0, 10, 3),
        row('', `${SITE}/tools/x`, 0, 0, 0),
        row('', `${SITE}/exercises`, 0, 5, 4),
      ];

      expect(analysis.findUnseenUrls(sitemap, pageRows)).toEqual([
        `${SITE}/tools/x`,
        `${SITE}/programs/y`,
      ]);
    });
  });

  describe('topPagesWithQueries', () => {
    it('orders pages by clicks and caps queries per page by impressions', () => {
      const rows = [
        row('a1', `${SITE}/a`, 5, 100, 3),
        row('a2', `${SITE}/a`, 1, 50, 4),
        row('a3', `${SITE}/a`, 0, 200, 5),
        row('b1', `${SITE}/b`, 10, 20, 1),
        row('c1', `${SITE}/c`, 2, 1000, 9),
      ];

      const result = analysis.topPagesWithQueries(rows, { pages: 2, queriesPerPage: 2 });

      expect(result.map((p) => p.page)).toEqual(['/b', '/a']);
      expect(result[1].clicks).toBe(6);
      expect(result[1].impressions).toBe(350);
      expect(result[1].queries).toEqual(['a3', 'a1']);
    });
  });

  describe('byCountry', () => {
    it('groups by country, orders by impressions and applies the limit', () => {
      const rows = [
        row('a', SITE, 1, 300, 2, 'usa'),
        row('b', SITE, 1, 500, 2, 'deu'),
        row('c', SITE, 1, 100, 2, 'esp'),
      ];

      const result = analysis.byCountry(rows, { limit: 2 });

      expect(result.map((c) => c.key)).toEqual(['deu', 'usa']);
    });
  });

  describe('findWeakLandingPages', () => {
    it('keeps pages at or below the engagement rate with enough sessions', () => {
      const rows = [
        { landingPage: '/weak', sessions: 100, engagementRate: 0.2 },
        { landingPage: '/edge', sessions: 50, engagementRate: 0.4 },
        { landingPage: '/few', sessions: 19, engagementRate: 0.1 },
        { landingPage: '/good', sessions: 200, engagementRate: 0.6 },
      ];

      expect(analysis.findWeakLandingPages(rows).map((r) => r.landingPage)).toEqual([
        '/weak',
        '/edge',
      ]);
    });
  });

  describe('conversionByPage', () => {
    it('counts store clicks and demo starts per path and joins sessions', () => {
      const conversionRows = [
        { eventName: 'store_button_click', pagePath: '/food?x=1', eventCount: 3 },
        { eventName: 'store_button_click', pagePath: '/food', eventCount: 2 },
        { eventName: 'demo_start', pagePath: '/food', eventCount: 4 },
        { eventName: 'page_view', pagePath: '/food', eventCount: 99 },
        { eventName: 'store_button_click', pagePath: '/workouts', eventCount: 1 },
        { eventName: 'demo_start', pagePath: '/workouts', eventCount: 10 },
      ];
      const landingRows = [{ landingPage: '/food?src=x', sessions: 50 }];

      const result = analysis.conversionByPage(conversionRows, landingRows);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        page: '/workouts',
        storeClicks: 1,
        demoStarts: 10,
        sessions: null,
        storeClickRate: null,
      });
      expect(result[1].page).toBe('/food');
      expect(result[1].storeClicks).toBe(5);
      expect(result[1].demoStarts).toBe(4);
      expect(result[1].sessions).toBe(50);
      expect(result[1].storeClickRate).toBeCloseTo(0.1);
    });
  });
});
