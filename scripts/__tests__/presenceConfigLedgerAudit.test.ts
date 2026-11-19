import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const config = require('../presence/config') as {
  addDays: (isoDate: string, days: number) => string;
  dateWindows: (
    days: number,
    options?: { today?: Date; lagDays?: number }
  ) => {
    days: number;
    current: { start: string; end: string };
    previous: { start: string; end: string };
  };
  findKeyPath: (
    env?: Record<string, string | undefined>,
    home?: string,
    exists?: (candidate: string) => boolean
  ) => string | null;
  keyCandidates: (env?: Record<string, string | undefined>, home?: string) => string[];
  loadConfig: (options?: { env?: Record<string, string | undefined>; configPath?: string }) => {
    gscSite: string | null;
    ga4Property: string | null;
    playStatsBucket: string | null;
    playProfile: string;
  };
};

const ledger = require('../presence/ledger') as {
  dueEntries: (entries: LedgerEntry[], today: string) => LedgerEntry[];
  parseLedger: (markdown: string) => LedgerEntry[];
};

const siteAudit = require('../presence/siteAudit') as {
  auditSite: (options: { root?: string; sitemapUrls?: string[] | null }) => AuditResult;
  parseSitemapUrls: (xml: string) => string[];
};

interface LedgerEntry {
  date: string;
  change: string;
  target: string;
  evidence: string;
  reviewOn: string | null;
}

interface Finding {
  severity: string;
  kind: string;
  target: string;
  message: string;
}

interface AuditResult {
  findings: Finding[];
  stats: {
    sitemapUrls: number | null;
    indexableRoutes: number;
    locales: string[];
    posts: number;
    postsByCategory: Record<string, number>;
  };
  posts: { path: string; category: string | null; tags: string[] }[];
  sitemapUrls: string[];
}

const DAY_MS = 86_400_000;

describe('presence config', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'musclog-presence-config-'));
  });

  afterEach(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  describe('dateWindows', () => {
    it('lags the current window by three days and ends the previous one before it', () => {
      const windows = config.dateWindows(28, { today: new Date('2026-11-19T12:00:00Z') });

      expect(windows.days).toBe(28);
      expect(windows.current).toEqual({ start: '2026-10-20', end: '2026-11-16' });
      expect(windows.previous).toEqual({ start: '2026-09-22', end: '2026-10-19' });
    });

    it('makes both windows exactly `days` inclusive days long', () => {
      const windows = config.dateWindows(28, { today: new Date('2026-11-19T12:00:00Z') });
      const inclusiveDays = (window: { start: string; end: string }) =>
        (Date.parse(`${window.end}T00:00:00Z`) - Date.parse(`${window.start}T00:00:00Z`)) / DAY_MS +
        1;

      expect(inclusiveDays(windows.current)).toBe(28);
      expect(inclusiveDays(windows.previous)).toBe(28);
    });
  });

  describe('addDays', () => {
    it('crosses a year boundary forwards', () => {
      expect(config.addDays('2026-12-30', 3)).toBe('2027-01-02');
    });

    it('crosses a year boundary backwards', () => {
      expect(config.addDays('2027-01-02', -3)).toBe('2026-12-30');
    });

    it('crosses a leap-less February boundary backwards', () => {
      expect(config.addDays('2026-03-01', -1)).toBe('2026-02-28');
    });
  });

  describe('findKeyPath', () => {
    const home = '/home/someone';
    const personal = path.join(home, 'keys', 'musclog-presence-service-account.json');
    const play = path.join(home, 'keys', 'musclog-play-service-account.json');

    it('lists the explicit key first, then the presence key, then the Play key', () => {
      expect(config.keyCandidates({ MUSCLOG_PRESENCE_KEY: '/custom.json' }, home)).toEqual([
        '/custom.json',
        personal,
        play,
      ]);
    });

    it('prefers MUSCLOG_PRESENCE_KEY when it exists', () => {
      const exists = (candidate: string) => candidate === '/custom.json' || candidate === personal;

      expect(config.findKeyPath({ MUSCLOG_PRESENCE_KEY: '/custom.json' }, home, exists)).toBe(
        '/custom.json'
      );
    });

    it('falls back to the presence key file, then to the Play key', () => {
      expect(
        config.findKeyPath(
          { MUSCLOG_PRESENCE_KEY: '/missing.json' },
          home,
          (c) => c === personal || c === play
        )
      ).toBe(personal);
      expect(config.findKeyPath({}, home, (c) => c === play)).toBe(play);
    });

    it('returns null when no candidate exists', () => {
      expect(config.findKeyPath({}, home, () => false)).toBeNull();
    });
  });

  describe('loadConfig', () => {
    it('lets environment variables beat the config file', async () => {
      const configPath = path.join(directory, 'config.json');

      await writeFile(
        configPath,
        JSON.stringify({
          gscSite: 'file-site',
          ga4Property: 'properties/999',
          playStatsBucket: 'file-bucket',
          playProfile: 'file-profile',
        })
      );

      const loaded = config.loadConfig({
        env: {
          MUSCLOG_GSC_SITE: 'env-site',
          MUSCLOG_GA4_PROPERTY: 'properties/555',
          MUSCLOG_PLAY_STATS_BUCKET: 'env-bucket',
          GPLAY_PROFILE: 'env-profile',
        },
        configPath,
      });

      expect(loaded).toEqual({
        gscSite: 'env-site',
        ga4Property: '555',
        playStatsBucket: 'env-bucket',
        playProfile: 'env-profile',
      });
    });

    it('uses the file values when the environment is empty, stripping the properties/ prefix', async () => {
      const configPath = path.join(directory, 'config.json');

      await writeFile(
        configPath,
        JSON.stringify({ gscSite: 'file-site', ga4Property: 'properties/999' })
      );

      expect(config.loadConfig({ env: {}, configPath })).toEqual({
        gscSite: 'file-site',
        ga4Property: '999',
        playStatsBucket: null,
        playProfile: 'musclog',
      });
    });

    it('gives a null ga4Property when the value is only the prefix', async () => {
      const configPath = path.join(directory, 'config.json');

      await writeFile(configPath, JSON.stringify({ ga4Property: 'properties/' }));

      expect(config.loadConfig({ env: {}, configPath }).ga4Property).toBeNull();
    });

    it('returns nulls and the musclog profile when the config file is missing', () => {
      expect(
        config.loadConfig({ env: {}, configPath: path.join(directory, 'absent.json') })
      ).toEqual({
        gscSite: null,
        ga4Property: null,
        playStatsBucket: null,
        playProfile: 'musclog',
      });
    });

    it('returns nulls and the musclog profile when the config file is invalid JSON', async () => {
      const configPath = path.join(directory, 'config.json');

      await writeFile(configPath, '{ not json');

      expect(config.loadConfig({ env: {}, configPath })).toEqual({
        gscSite: null,
        ga4Property: null,
        playStatsBucket: null,
        playProfile: 'musclog',
      });
    });
  });
});

describe('presence change ledger', () => {
  const doc = [
    '# Online presence',
    '',
    '## Weekly check',
    '',
    '| Date | Metric | Value |',
    '| --- | --- | --- |',
    '| 2026-11-01 | clicks | 10 |',
    '',
    '## Change ledger',
    '',
    '| Date | Change | Target | Evidence | Review on |',
    '| --- | --- | --- | --- | --- |',
    '| _none yet_ | | | | |',
    '| 2026-11-20 | Rewrote /tools title | `/tools/one-rep-max` | 400 impressions, ctr 0.8% | 2026-12-18 |',
    '| 2026-11-21 | Changed description | `/blog/x` | 120 clicks | next week |',
    '',
    '## Appendix',
    '',
    '| 2026-11-22 | Later note | `/later` | none | 2026-12-01 |',
    '',
  ].join('\n');

  it('parses exactly the two real rows of the ledger section', () => {
    const entries = ledger.parseLedger(doc);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      date: '2026-11-20',
      change: 'Rewrote /tools title',
      target: '/tools/one-rep-max',
      evidence: '400 impressions, ctr 0.8%',
      reviewOn: '2026-12-18',
    });
  });

  it('gives a null reviewOn for a review cell that is not an ISO day', () => {
    const entries = ledger.parseLedger(doc);

    expect(entries[1].reviewOn).toBeNull();
    expect(entries[1].target).toBe('/blog/x');
  });

  it('ignores rows in sections after the ledger', () => {
    expect(ledger.parseLedger(doc).some((entry) => entry.date === '2026-11-22')).toBe(false);
  });

  it('returns no entries when the document has no ledger heading', () => {
    expect(ledger.parseLedger(doc.replace('## Change ledger', '## Something else'))).toEqual([]);
  });

  describe('dueEntries', () => {
    const entries: LedgerEntry[] = [
      { date: '2026-11-20', change: 'a', target: '/a', evidence: '', reviewOn: '2026-12-18' },
      { date: '2026-11-21', change: 'b', target: '/b', evidence: '', reviewOn: '2026-12-19' },
      { date: '2026-11-22', change: 'c', target: '/c', evidence: '', reviewOn: null },
    ];

    it('includes entries whose review date is today or earlier', () => {
      expect(ledger.dueEntries(entries, '2026-12-18').map((entry) => entry.target)).toEqual(['/a']);
    });

    it('excludes entries with a later or null review date', () => {
      const due = ledger.dueEntries(entries, '2026-12-18');

      expect(due.some((entry) => entry.target === '/b')).toBe(false);
      expect(due.some((entry) => entry.target === '/c')).toBe(false);
    });
  });
});

describe('site audit', () => {
  const sharedTitle = 'Free strength training tools for one-rep max, macros and more';
  const tooLongTitle = sharedTitle;
  let root: string;

  async function write(relative: string, contents: string) {
    const file = path.join(root, relative);

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, contents);
  }

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'musclog-site-audit-'));
    expect(tooLongTitle.length).toBeGreaterThan(60);

    await write(
      'components/website/websiteRoutes.json',
      JSON.stringify({
        home: { path: '/' },
        tools: { path: '/tools' },
        open: { path: '/open', robots: 'noindex' },
      })
    );

    await write(
      'lang/locales/en-us/website.json',
      JSON.stringify({
        website: {
          seo: {
            routes: {
              home: {
                title: sharedTitle,
                description:
                  'Log workouts, food and body metrics on your phone, with no account and no ads. Built for lifters who want a plain record.',
              },
              tools: { title: sharedTitle },
              open: { title: 'Open in Musclog', description: 'Opens the app.' },
            },
          },
        },
      })
    );

    await write(
      'lang/locales/es-es/website.json',
      JSON.stringify({
        website: {
          seo: {
            routes: {
              home: {
                title: 'Musclog: registro de entrenos',
                description:
                  'Registra entrenos, comida y medidas corporales en tu móvil, sin cuenta y sin anuncios. Pensado para quien quiere un registro sencillo.',
              },
            },
          },
        },
      })
    );

    await write(
      'app/(website)/posts/a.md',
      [
        '---',
        'title: Short post',
        'date: 2026-11-01',
        'category: guides',
        'tags: [strength]',
        '---',
        '',
        'A short body with a single picture.',
        '',
        '![](x.png)',
        '',
      ].join('\n')
    );

    await write(
      'app/(website)/posts/sub/b.md',
      [
        '---',
        'title: Nested post',
        'date: 2026-11-02',
        'category: programs',
        'tags: [plan]',
        'description: A nested post that links to a tool page on the site for the reader.',
        '---',
        '',
        'See the [one-rep max tool](/tools/one-rep-max) for numbers.',
        '',
      ].join('\n')
    );
  });

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  function audit(sitemapUrls: string[] | null = ['https://musclog.app']) {
    return siteAudit.auditSite({ root, sitemapUrls });
  }

  it('reports route title, description, locale and sitemap problems', () => {
    const { findings } = audit();
    const kinds = (target: string) =>
      findings.filter((finding) => finding.target === target).map((finding) => finding.kind);

    expect(kinds('/tools')).toEqual(
      expect.arrayContaining([
        'route-title-long',
        'route-description-missing',
        'route-not-in-sitemap',
      ])
    );
  });

  it('reports the missing es-es translation for tools', () => {
    const locale = audit().findings.find((finding) => finding.kind === 'route-locale-missing');

    expect(locale?.target).toContain('es-es');
    expect(locale?.target).toContain('/tools');
  });

  it('reports the shared title on both routes', () => {
    const duplicate = audit().findings.find((finding) => finding.kind === 'route-title-duplicate');

    expect(duplicate?.target).toContain('/tools');
    expect(duplicate?.target).toContain('/');
  });

  it('does not audit the noindex /open route', () => {
    expect(audit().findings.filter((finding) => finding.target.startsWith('/open'))).toEqual([]);
  });

  it('reports the post problems and nothing for the linked nested post', () => {
    const { findings } = audit();
    const postFindings = (target: string) =>
      findings.filter((finding) => finding.target === target).map((finding) => finding.kind);

    expect(postFindings('/blog/a')).toEqual(
      expect.arrayContaining([
        'post-thin',
        'post-no-internal-links',
        'post-image-no-alt',
        'post-description-missing',
      ])
    );
    expect(postFindings('/blog/sub/b')).not.toContain('post-no-internal-links');
    expect(postFindings('/blog/sub/b')).not.toContain('post-description-missing');
  });

  it('reports the stats for posts, categories and locales', () => {
    const { stats, posts } = audit();

    expect(stats.posts).toBe(2);
    expect(stats.postsByCategory).toEqual({ guides: 1, programs: 1 });
    expect(stats.locales).toEqual(expect.arrayContaining(['en-us', 'es-es']));
    expect(stats.indexableRoutes).toBe(2);
    expect(stats.sitemapUrls).toBe(1);
    expect(posts.map((post) => post.path).sort()).toEqual(['/blog/a', '/blog/sub/b']);
    expect(posts.find((post) => post.path === '/blog/sub/b')?.tags).toEqual(['plan']);
  });

  it('reads the sitemap from public/sitemap.xml when no URLs are passed', async () => {
    await write(
      'public/sitemap.xml',
      '<urlset><url><loc>https://musclog.app/en</loc></url><url><loc>https://musclog.app/en/tools</loc></url></urlset>'
    );

    const { stats, findings } = siteAudit.auditSite({ root });

    expect(stats.sitemapUrls).toBe(2);
    expect(findings.some((finding) => finding.kind === 'route-not-in-sitemap')).toBe(false);
  });
});

describe('parseSitemapUrls', () => {
  it('returns the URL of each <loc> entry in order', () => {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      '  <url><loc>https://musclog.app/</loc></url>',
      '  <url><loc> https://musclog.app/tools </loc></url>',
      '</urlset>',
    ].join('\n');

    expect(siteAudit.parseSitemapUrls(xml)).toEqual([
      'https://musclog.app/',
      'https://musclog.app/tools',
    ]);
  });
});
