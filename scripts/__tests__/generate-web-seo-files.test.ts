import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const {
  blogCategoryPaths,
  blogPaginationPaths,
  discoverBlogCategoryPostCounts,
  discoverBlogPostPaths,
} = require('../generate-web-seo-files') as {
  blogCategoryPaths: (
    categoryPostCounts: Record<string, number>,
    postsPerPage?: number
  ) => string[];
  blogPaginationPaths: (postCount: number, postsPerPage?: number) => string[];
  discoverBlogCategoryPostCounts: (postsDirectory: string) => Record<string, number>;
  discoverBlogPostPaths: (postsDirectory: string) => string[];
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
