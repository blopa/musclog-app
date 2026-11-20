import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const {
  blogCategoryPaths,
  blogPaginationPaths,
  blogTagPaths,
  discoverBlogCategoryPostCounts,
  discoverBlogPostPaths,
  discoverBlogTagPostCounts,
  generateLlmsTxt,
  generateRobotsTxt,
  generateSitemapXml,
} = require('../generate-web-seo-files') as {
  blogCategoryPaths: (
    categoryPostCounts: Record<string, number>,
    postsPerPage?: number
  ) => string[];
  blogPaginationPaths: (postCount: number, postsPerPage?: number) => string[];
  blogTagPaths: (tagPostCounts: Record<string, number>, postsPerPage?: number) => string[];
  discoverBlogCategoryPostCounts: (postsDirectory: string) => Record<string, number>;
  discoverBlogPostPaths: (postsDirectory: string) => string[];
  discoverBlogTagPostCounts: (postsDirectory: string) => Record<string, number>;
  generateLlmsTxt: () => string;
  generateRobotsTxt: () => string;
  generateSitemapXml: () => string;
};

describe('generate-web-seo-files blog routes', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'musclog-blog-seo-'));
  });

  afterEach(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  it('discovers nested Markdown posts as public sitemap paths', async () => {
    await mkdir(path.join(directory, '2026', '08'), { recursive: true });
    await writeFile(path.join(directory, '2026', '08', 'new-post.md'), '# New');
    await writeFile(path.join(directory, '2026', '08', 'ignored.txt'), 'Not a post');

    expect(discoverBlogPostPaths(directory)).toEqual(['/blog/2026/08/new-post']);
  });

  it('rejects filenames that cannot form stable public URLs', async () => {
    await writeFile(path.join(directory, 'bad post.md'), '# Bad');

    expect(() => discoverBlogPostPaths(directory)).toThrow(
      'Invalid blog post path for a public URL: bad post.md'
    );
  });

  it('adds sitemap paths for every blog page after the index', () => {
    expect(blogPaginationPaths(0, 2)).toEqual([]);
    expect(blogPaginationPaths(2, 2)).toEqual([]);
    expect(blogPaginationPaths(3, 2)).toEqual(['/blog/page/2']);
    expect(blogPaginationPaths(5, 2)).toEqual(['/blog/page/2', '/blog/page/3']);
  });

  it('discovers category counts and adds each category pagination path', async () => {
    await writeFile(
      path.join(directory, 'update-one.md'),
      '---\ncategory: product-updates\n---\nFirst update'
    );
    await writeFile(
      path.join(directory, 'update-two.md'),
      '---\ncategory: product-updates\n---\nSecond update'
    );
    await writeFile(path.join(directory, 'retro.md'), '---\ncategory: retro\n---\nRetro post');

    expect(discoverBlogCategoryPostCounts(directory)).toEqual({
      'product-updates': 2,
      retro: 1,
    });
    expect(blogCategoryPaths({ 'product-updates': 3, retro: 1 }, 2)).toEqual([
      '/blog/category/product-updates',
      '/blog/category/product-updates/page/2',
      '/blog/category/retro',
    ]);
  });

  it('lists the category index in the sitemap', () => {
    expect(generateSitemapXml()).toContain('<loc>https://musclog.app/en/blog/category</loc>');
  });

  it('discovers tag counts, counting a post once per tag slug', async () => {
    await writeFile(
      path.join(directory, 'one.md'),
      "---\ntags: ['Open Source', 'open source', 'Expo']\n---\nOne"
    );
    await writeFile(path.join(directory, 'two.md'), "---\ntags: ['Expo']\n---\nTwo");

    expect(discoverBlogTagPostCounts(directory)).toEqual({ expo: 2, 'open-source': 1 });
  });

  it('lists each tag page and its pagination, with the first page not repeated', () => {
    expect(blogTagPaths({ expo: 3, 'open-source': 1 }, 2)).toEqual([
      '/blog/tag/expo',
      '/blog/tag/expo/page/2',
      '/blog/tag/open-source',
    ]);
  });

  it('rejects a tag list that is missing, not an array, or has a blank entry', async () => {
    await writeFile(path.join(directory, 'no-tags.md'), '---\ncategory: retro\n---\nNo tags');
    expect(() => discoverBlogTagPostCounts(directory)).toThrow(
      'Invalid blog tag in no-tags.md: tags must be an array of non-empty strings'
    );

    await rm(path.join(directory, 'no-tags.md'));
    await writeFile(path.join(directory, 'bad.md'), "---\ntags: 'Expo'\n---\nBad");
    expect(() => discoverBlogTagPostCounts(directory)).toThrow('Invalid blog tag in bad.md');
  });

  it('rejects a tag with no URL-safe characters', async () => {
    await writeFile(path.join(directory, 'symbols.md'), "---\ntags: ['!!!']\n---\nSymbols");

    expect(() => discoverBlogTagPostCounts(directory)).toThrow(
      'Invalid blog tag in symbols.md: "!!!" has no URL-safe characters'
    );
  });

  it('rejects categories that cannot form stable public URLs', async () => {
    await writeFile(
      path.join(directory, 'bad-category.md'),
      '---\ncategory: Product updates\n---\nBad category'
    );

    expect(() => discoverBlogCategoryPostCounts(directory)).toThrow(
      'Invalid blog category in bad-category.md'
    );
  });
});

describe('generate-web-seo-files tools and programs', () => {
  const { PROGRAM_SLUGS } = require('../../components/website/programRoutes') as {
    PROGRAM_SLUGS: string[];
  };

  it('lists the tag cloud in the sitemap', () => {
    expect(generateSitemapXml()).toContain('<loc>https://musclog.app/en/blog/tag</loc>');
  });

  it('lists the tools index, every tool and every program page in the sitemap', () => {
    const sitemap = generateSitemapXml();
    for (const routePath of ['/tools', '/tools/one-rep-max', '/tools/net-carbs', '/programs']) {
      expect(sitemap).toContain(`<loc>https://musclog.app/en${routePath}</loc>`);
    }

    for (const slug of PROGRAM_SLUGS) {
      expect(sitemap).toContain(`<loc>https://musclog.app/en/programs/${slug}</loc>`);
    }
  });
});

describe('generate-web-seo-files localized sitemap', () => {
  const { WEBSITE_LOCALES } = require('../../components/website/localeRoutes') as {
    WEBSITE_LOCALES: { prefix: string; hreflang: string }[];
  };
  const { PROGRAM_SLUGS } = require('../../components/website/programRoutes') as {
    PROGRAM_SLUGS: string[];
  };
  const sitemap = generateSitemapXml();
  const blocks = sitemap.split('<url>').slice(1);
  const parsed = blocks.map((block) => ({
    loc: /<loc>([^<]+)<\/loc>/.exec(block)![1],
    alternates: [...block.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]),
  }));
  const byLoc = new Map(parsed.map((entry) => [entry.loc, entry]));

  it('declares the xhtml namespace', () => {
    expect(sitemap).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  it('lists home as /en without a trailing slash', () => {
    expect(byLoc.has('https://musclog.app/en')).toBe(true);
    expect(byLoc.has('https://musclog.app/es')).toBe(true);
  });

  it('lists a url per locale for every translated route and program', () => {
    for (const logical of ['/tools/one-rep-max', '/download', `/programs/${PROGRAM_SLUGS[0]}`]) {
      for (const locale of WEBSITE_LOCALES) {
        expect(byLoc.has(`https://musclog.app/${locale.prefix}${logical}`)).toBe(true);
      }
    }
  });

  it('gives each locale url the identical, reciprocal alternate set with x-default', () => {
    const sets = new Map<string, string>();
    for (const entry of parsed) {
      if (entry.alternates.length === 0) {
        continue;
      }

      expect(entry.alternates).toHaveLength(WEBSITE_LOCALES.length + 1);
      expect(entry.alternates.map(([lang]) => lang)).toContain('x-default');
      expect(entry.alternates.map(([, href]) => href)).toContain(entry.loc);
      const xDefault = entry.alternates.find(([lang]) => lang === 'x-default')![1];
      expect(xDefault).toMatch(/^https:\/\/musclog\.app\/en(\/|$)/);
      sets.set(entry.loc, JSON.stringify(entry.alternates));
    }

    const distinct = new Set(sets.values());
    expect(distinct.size).toBe(sets.size / WEBSITE_LOCALES.length);
    // A url's set is the set its siblings carry.
    const oneRepMax = WEBSITE_LOCALES.map((l) =>
      JSON.stringify(byLoc.get(`https://musclog.app/${l.prefix}/tools/one-rep-max`)!.alternates)
    );
    expect(new Set(oneRepMax).size).toBe(1);
  });

  it('lists blog urls once, under /en/blog, with no alternates', () => {
    const blogEntries = parsed.filter((entry) => /\/blog(\/|$)/.test(entry.loc));
    expect(blogEntries.length).toBeGreaterThan(0);
    for (const entry of blogEntries) {
      expect(entry.loc).toMatch(/^https:\/\/musclog\.app\/en\/blog(\/|$)/);
      expect(entry.alternates).toEqual([]);
    }

    expect(sitemap).not.toMatch(/\/(es|nl|pt-br|ru|de|fr|it|pl|tr)\/blog/);
    expect(sitemap).toContain('<loc>https://musclog.app/en/blog</loc>');
    expect(sitemap).toMatch(/<loc>https:\/\/musclog\.app\/en\/blog\/\d{4}\//);
    expect(new Set(parsed.map((entry) => entry.loc)).size).toBe(parsed.length);
  });

  it('never lists /open, /test or an unprefixed address', () => {
    for (const entry of parsed) {
      expect(entry.loc).toMatch(
        /^https:\/\/musclog\.app\/(en|es|nl|pt-br|ru|de|fr|it|pl|tr)(\/|$)/
      );
      expect(entry.loc).not.toMatch(/\/(open|test)(\/|$)/);
    }
  });

  it('links English urls only in llms.txt', () => {
    const urls = [...generateLlmsTxt().matchAll(/\]\((https:\/\/musclog\.app[^)]*)\)/g)].map(
      (m) => m[1]
    );
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/musclog\.app\/en(\/|$)/);
    }
  });

  it('keeps robots.txt disallowing the unprefixed noindex routes', () => {
    expect(generateRobotsTxt()).toContain('Disallow: /open');
    expect(generateRobotsTxt()).toContain('Disallow: /test');
  });
});
