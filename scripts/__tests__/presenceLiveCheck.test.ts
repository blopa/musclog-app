type Result = { url: string; status: number; location: string | null };
type LiveCheck = {
  checkUrls: (
    urls: string[],
    options?: { fetchImpl?: unknown; concurrency?: number; timeoutMs?: number }
  ) => Promise<Result[]>;
  summarizeLiveCheck: (
    results: Result[],
    total: number
  ) => {
    checked: number;
    ok: number;
    problems: Result[];
    byStatus: Record<string, number>;
    downgradesToHttp: number;
  };
};
type Report = {
  buildDigest: (snapshot: unknown) => { live?: unknown };
  renderMarkdown: (digest: unknown) => string;
};

const { checkUrls, summarizeLiveCheck }: LiveCheck = require('../presence/liveCheck');
const { buildDigest, renderMarkdown }: Report = require('../presence/report');

const reply = (status: number, location?: string) => ({
  status,
  headers: { get: (name: string) => (name === 'location' ? (location ?? null) : null) },
});

describe('checkUrls', () => {
  it('omits 200s and keeps redirects with their location', async () => {
    const fetchImpl = jest.fn(async (url: string) =>
      url.endsWith('/ok') ? reply(200) : reply(301, 'http://musclog.app/blog/')
    );

    const results = await checkUrls(['https://musclog.app/ok', 'https://musclog.app/blog'], {
      fetchImpl,
    });

    expect(results).toEqual([
      { url: 'https://musclog.app/blog', status: 301, location: 'http://musclog.app/blog/' },
    ]);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });

  it('records a thrown error as status 0', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('ECONNRESET');
    });

    expect(await checkUrls(['https://musclog.app/x'], { fetchImpl })).toEqual([
      { url: 'https://musclog.app/x', status: 0, location: 'ECONNRESET' },
    ]);
  });

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const fetchImpl = jest.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;

      return reply(200);
    });
    const urls = Array.from({ length: 20 }, (_, index) => `https://musclog.app/${index}`);

    await checkUrls(urls, { fetchImpl, concurrency: 3 });

    expect(fetchImpl).toHaveBeenCalledTimes(20);
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });
});

describe('summarizeLiveCheck and the report', () => {
  const results: Result[] = [
    { url: 'https://musclog.app/a', status: 301, location: 'http://musclog.app/a/' },
    { url: 'https://musclog.app/b', status: 301, location: 'https://musclog.app/b/' },
    { url: 'https://musclog.app/c', status: 404, location: null },
  ];

  it('counts statuses and http downgrades', () => {
    expect(summarizeLiveCheck(results, 10)).toEqual({
      checked: 10,
      ok: 7,
      problems: results,
      byStatus: { '301': 2, '404': 1 },
      downgradesToHttp: 1,
    });
  });

  it('renders the section with a problem row', () => {
    const snapshot = {
      generatedAt: '2026-11-19T10:00:00.000Z',
      window: {
        days: 28,
        current: { start: '2026-10-19', end: '2026-11-16' },
        previous: { start: '2026-09-21', end: '2026-10-18' },
      },
      sources: { live: { ok: true, data: summarizeLiveCheck(results, 10) } },
    };
    const markdown = renderMarkdown(buildDigest(snapshot));

    expect(markdown).toContain('## Live sitemap check');
    expect(markdown).toContain('7 of 10 sitemap URLs answer 200.');
    expect(markdown).toContain('| 301 | https://musclog.app/a | http://musclog.app/a/ |');
    expect(markdown).toContain('1 redirect to plain http');
  });
});
