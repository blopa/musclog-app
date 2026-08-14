import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  loadBlogPost,
  loadBlogPostForRoute,
  loadBlogPostPage,
  loadBlogPostPageForRoute,
  loadBlogPostSummaries,
  paginateBlogPosts,
  parseBlogPostSummary,
  renderBlogPostMarkdown,
} from '../blogPosts.server';

describe('blogPosts.server', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { force: true, recursive: true }))
    );
  });

  // These two run against the posts actually shipped in `app/(website)/posts`. They assert
  // structure, never prose: pinning a sentence would turn every edit to a published post into a
  // failing build, which is what the previous "Lorem ipsum" assertions did.
  it('loads every shipped post with valid frontmatter, newest first', async () => {
    const posts = await loadBlogPostSummaries();

    expect(posts.length).toBeGreaterThan(0);
    expect(new Set(posts.map((post) => post.slug)).size).toBe(posts.length);

    for (const post of posts) {
      expect(post.slug).toMatch(/^[a-z0-9]+(?:[-_][a-z0-9]+)*(?:\/[a-z0-9]+(?:[-_][a-z0-9]+)*)*$/i);
      expect(post.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(post.title.trim()).not.toBe('');
      expect(post.category.trim()).not.toBe('');
      expect(post.excerpt.trim()).not.toBe('');
    }

    const dates = posts.map((post) => post.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('renders a shipped post body to HTML without exposing Markdown to the client', async () => {
    const [newest] = await loadBlogPostSummaries();
    const post = await loadBlogPost(newest.slug);

    expect(post.html).toContain('<p>');
    expect(post.html).toContain('<h2>');
    // Fenced code arrives highlighted, not as Markdown backticks.
    expect(post.html).toMatch(/<pre class="hljs"><code class="language-[a-z]+">/);
    expect(post.html).toContain('<span class="hljs-keyword">');
    expect(post.html).not.toContain('```');
  });

  it('renders rich Markdown and keeps raw HTML and unsafe links inert', () => {
    const html = renderBlogPostMarkdown(`
## Examples

> A useful quote.

| Feature | Support |
| --- | --- |
| Tables | Yes |

\`\`\`typescript
const answer: number = 42;
\`\`\`

<script>alert('nope')</script>

[unsafe](javascript:alert('nope'))
`);

    expect(html).toContain('<h2>Examples</h2>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<table>');
    expect(html).toContain('<code class="language-typescript">');
    expect(html).toContain('<span class="hljs-keyword">const</span>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
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

    const templatePost = await loadBlogPostForRoute('[...slug]', directory);
    expect(templatePost.slug).toBe('2026/08/new');
    expect(templatePost.html).toContain('<p>Newest body.</p>');
  });

  it('paginates sorted summaries without repeating posts', () => {
    const posts = Array.from({ length: 5 }, (_, index) => ({
      category: 'Updates',
      date: `2026-08-0${5 - index}`,
      excerpt: `Summary ${index + 1}`,
      slug: `post-${index + 1}`,
      tags: [],
      title: `Post ${index + 1}`,
    }));
    const firstPage = paginateBlogPosts(posts, 1, 2);
    const secondPage = paginateBlogPosts(posts, 2, 2);
    const lastPage = paginateBlogPosts(posts, 3, 2);

    expect(firstPage).toMatchObject({ currentPage: 1, totalPages: 3, totalPosts: 5 });
    expect(firstPage.posts).toEqual(posts.slice(0, 2));
    expect(secondPage.posts).toEqual(posts.slice(2, 4));
    expect(lastPage.posts).toEqual(posts.slice(4, 5));
    expect([...firstPage.posts, ...secondPage.posts, ...lastPage.posts]).toEqual(posts);
  });

  it('loads configured pages and handles Expo dynamic route templates', async () => {
    const firstPage = await loadBlogPostPage(1);
    const secondPage = await loadBlogPostPageForRoute('2');
    const templatePage = await loadBlogPostPageForRoute('[page]');

    expect(firstPage.posts).toHaveLength(2);
    expect(secondPage.currentPage).toBe(2);
    expect(secondPage.posts).toHaveLength(2);
    expect(templatePage).toEqual(firstPage);
  });

  it('rejects invalid and out-of-range blog pages', async () => {
    await expect(loadBlogPostPageForRoute('0')).rejects.toThrow('Invalid blog page');
    await expect(loadBlogPostPageForRoute('2.5')).rejects.toThrow('Invalid blog page');
    await expect(loadBlogPostPage(999)).rejects.toThrow('Blog page 999 does not exist');
  });

  it('rejects invalid required metadata with the source path', () => {
    expect(() =>
      parseBlogPostSummary(
        '---\ntitle: Missing fields\ndate: tomorrow\ncategory: Development\ntags: [Expo]\n---\nBody',
        '2026/08/broken.md'
      )
    ).toThrow('Invalid blog frontmatter in 2026/08/broken.md: "date" must use YYYY-MM-DD');
  });

  it('rejects path traversal in post slugs', async () => {
    await expect(loadBlogPost(['..', 'secrets'])).rejects.toThrow('Invalid blog post slug');
  });
});
