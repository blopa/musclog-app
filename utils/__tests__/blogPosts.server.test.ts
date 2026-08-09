import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadBlogPostSummaries, parseBlogPostSummary } from '../blogPosts.server';

describe('blogPosts.server', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { force: true, recursive: true }))
    );
  });

  it('loads the repository example from frontmatter', async () => {
    const posts = await loadBlogPostSummaries();

    expect(posts).toContainEqual({
      category: 'development',
      date: '2026-08-09',
      excerpt: 'Lorem ipsum dolor sit amet.',
      slug: '2026/08/using-decimen-optical-transfer-foss-to-transfer-data-between-devices',
      tags: ['JavaScript', 'Markdown'],
      title: 'Using Decimen Optical Transfer FOSS to transfer data between devices',
    });
  });

  it('discovers nested Markdown files and sorts newest posts first', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'musclog-blog-'));
    temporaryDirectories.push(directory);
    await mkdir(path.join(directory, '2026', '08'), { recursive: true });
    await mkdir(path.join(directory, '2025', '12'), { recursive: true });
    await writeFile(
      path.join(directory, '2026', '08', 'new.md'),
      '---\ntitle: New post\ndate: 2026-08-09\ncategory: Updates\ntags: [Expo]\n---\nNewest body.\n'
    );
    await writeFile(
      path.join(directory, '2025', '12', 'old.md'),
      '---\ntitle: Old post\ndate: 2025-12-01\ncategory: Updates\ntags: []\ndescription: A custom summary.\n---\nOld body.\n'
    );

    const posts = await loadBlogPostSummaries(directory);

    expect(posts.map((post) => post.slug)).toEqual(['2026/08/new', '2025/12/old']);
    expect(posts[1].excerpt).toBe('A custom summary.');
  });

  it('rejects invalid required metadata with the source path', () => {
    expect(() =>
      parseBlogPostSummary(
        '---\ntitle: Missing fields\ndate: tomorrow\ncategory: Development\ntags: [Expo]\n---\nBody',
        '2026/08/broken.md'
      )
    ).toThrow('Invalid blog frontmatter in 2026/08/broken.md: "date" must use YYYY-MM-DD');
  });
});
