import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const { blogPaginationPaths, discoverBlogPostPaths } = require('../generate-web-seo-files') as {
  blogPaginationPaths: (postCount: number) => string[];
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
    expect(blogPaginationPaths(0)).toEqual([]);
    expect(blogPaginationPaths(2)).toEqual([]);
    expect(blogPaginationPaths(3)).toEqual(['/blog/page/2']);
    expect(blogPaginationPaths(5)).toEqual(['/blog/page/2', '/blog/page/3']);
  });
});
