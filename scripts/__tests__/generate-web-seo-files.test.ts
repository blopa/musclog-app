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
    expect(generateSitemapXml()).toContain('<loc>https://musclog.app/blog/category</loc>');
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
    expect(generateSitemapXml()).toContain('<loc>https://musclog.app/blog/tag</loc>');
  });

  it('lists the tools index, every tool and every program page in the sitemap', () => {
    const sitemap = generateSitemapXml();
    for (const routePath of ['/tools', '/tools/one-rep-max', '/tools/net-carbs', '/programs']) {
      expect(sitemap).toContain(`<loc>https://musclog.app${routePath}</loc>`);
    }

    for (const slug of PROGRAM_SLUGS) {
      expect(sitemap).toContain(`<loc>https://musclog.app/programs/${slug}</loc>`);
    }
  });
});
