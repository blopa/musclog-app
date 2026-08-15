import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  blogCategoryPath,
  blogListingPath,
  blogPagePath,
  blogPagePathsAfterFirst,
  totalBlogPages,
} from '@/components/website/blogRoutes';

import { loadBlogPostPage, loadBlogPostPageForRoute, paginateBlogPosts } from '../blogPosts.server';

const { blogCategoryPaths, blogPaginationPaths } =
  require('../../scripts/generate-web-seo-files') as {
    blogCategoryPaths: (counts: Record<string, number>, postsPerPage?: number) => string[];
    blogPaginationPaths: (postCount: number, postsPerPage?: number) => string[];
  };

describe('blogRoutes', () => {
  it('keeps page one at the bare path so a listing has exactly one URL', () => {
    expect(blogPagePath(1)).toBe('/blog');
    expect(blogPagePath(2)).toBe('/blog/page/2');
    expect(blogCategoryPath('retro')).toBe('/blog/category/retro');
    expect(blogCategoryPath('retro', 3)).toBe('/blog/category/retro/page/3');
    expect(blogListingPath(2)).toBe('/blog/page/2');
    expect(blogListingPath(2, 'retro')).toBe('/blog/category/retro/page/2');
  });

  it('always reports at least one page, so an empty blog still has /blog', () => {
    expect(totalBlogPages(0, 10)).toBe(1);
    expect(totalBlogPages(10, 10)).toBe(1);
    expect(totalBlogPages(11, 10)).toBe(2);
  });

  it('rejects nonsensical pagination inputs rather than emitting broken URLs', () => {
    expect(() => totalBlogPages(5, 0)).toThrow('Blog posts per page must be a positive integer');
    expect(() => totalBlogPages(5, 1.5)).toThrow('Blog posts per page must be a positive integer');
    expect(() => totalBlogPages(-1, 10)).toThrow('Blog post count must be a non-negative integer');
  });

  it('lists only the pages after the first, which the caller already has', () => {
    expect(blogPagePathsAfterFirst(0, 2)).toEqual([]);
    expect(blogPagePathsAfterFirst(2, 2)).toEqual([]);
    expect(blogPagePathsAfterFirst(5, 2)).toEqual(['/blog/page/2', '/blog/page/3']);
    expect(blogPagePathsAfterFirst(3, 2, 'retro')).toEqual(['/blog/category/retro/page/2']);
  });
});

/**
 * The sitemap generator and the Expo Router loaders derive blog pages independently — one from
 * CommonJS at build time, one from the route tree. They agree only because both go through
 * `blogRoutes.js`; before that they each had their own copy of the arithmetic, so the sitemap could
 * advertise a page the router never built (or miss one it did).
 */
describe('sitemap and router agree on which blog pages exist', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'musclog-blog-routes-'));
  });

  afterEach(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  it('emits a sitemap entry for exactly the pages a loader will render', async () => {
    const postCount = 23;
    await Promise.all(
      Array.from({ length: postCount }, (_, index) =>
        writeFile(
          path.join(directory, `post-${index}.md`),
          `---\ntitle: Post ${index}\ndate: 2026-08-${String((index % 28) + 1).padStart(2, '0')}\ncategory: retro\ntags: []\n---\nBody`
        )
      )
    );

    const { totalPages } = await loadBlogPostPage(1, directory);
    const sitemapPaths = blogPaginationPaths(postCount);

    expect(sitemapPaths).toHaveLength(totalPages - 1);

    // Every advertised page resolves, and the page after the last one does not exist.
    for (const [index] of sitemapPaths.entries()) {
      const page = await loadBlogPostPageForRoute(String(index + 2), directory);
      expect(page.currentPage).toBe(index + 2);
      expect(page.posts.length).toBeGreaterThan(0);
    }

    await expect(loadBlogPostPage(totalPages + 1, directory)).rejects.toThrow('does not exist');
  });

  it('emits the same category page count the loader paginates to', () => {
    const counts = { retro: 23, updates: 4 };
    const paths = blogCategoryPaths(counts);

    for (const [category, postCount] of Object.entries(counts)) {
      const posts = Array.from({ length: postCount }, (_, index) => ({
        category,
        date: '2026-08-01',
        excerpt: '',
        slug: `${category}-${index}`,
        tags: [],
        title: `Post ${index}`,
      }));
      const { totalPages } = paginateBlogPosts(posts, 1);

      expect(paths.filter((route) => route.startsWith(`/blog/category/${category}`))).toHaveLength(
        totalPages
      );
    }
  });
});
