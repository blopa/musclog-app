import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  BLOG_POSTS_PER_PAGE,
  getBlogCategories,
  loadBlogCategories,
  loadBlogCategorySummaries,
  loadBlogCategoryPage,
  loadBlogCategoryPageForRoute,
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

  it('renders every shipped post body to HTML without exposing Markdown to the client', async () => {
    // Every post, not the newest one: whichever post is newest may be a guide with no code in it.
    const summaries = await loadBlogPostSummaries();
    const posts = await Promise.all(summaries.map((summary) => loadBlogPost(summary.slug)));

    for (const post of posts) {
      expect(post.html).toContain('<p>');
      expect(post.html).toContain('<h2>');
      expect(post.html).not.toContain('```');
      // Fenced code arrives highlighted (or as a diagram), never as a bare <pre>.
      for (const [openTag] of post.html.matchAll(/<pre\b[^>]*>/g)) {
        expect(openTag).toMatch(/class="(hljs|mermaid)"/);
      }
    }

    // At least one shipped post has code, so the highlighter is exercised on real content too.
    const highlighted = posts.filter((post) =>
      /<pre class="hljs"><code class="language-[a-z]+">/.test(post.html)
    );
    expect(highlighted.length).toBeGreaterThan(0);
    expect(highlighted.some((post) => post.html.includes('<span class="hljs-keyword">'))).toBe(
      true
    );
  });

  it('leaves a mermaid fence as escaped source for the browser to draw, not as highlighted code', () => {
    const html = renderBlogPostMarkdown('```mermaid\nflowchart TD\n  A[<b>x</b>] --> B\n```');

    expect(html).toContain('<pre class="mermaid">flowchart TD');
    expect(html).toContain('A[&lt;b&gt;x&lt;/b&gt;] --&gt; B');
    expect(html).not.toContain('hljs');
    expect(html).not.toContain('<b>');
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
      '---\ntitle: New post\ndate: 2026-08-09\ncategory: updates\ntags: [Expo]\n---\nNewest body.\n'
    );
    await writeFile(
      path.join(directory, '2025', '12', 'old.md'),
      '---\ntitle: Old post\ndate: 2025-12-01\ncategory: updates\ntags: []\ndescription: A custom summary.\n---\nOld body.\n'
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
      category: 'updates',
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

  it('lists categories and paginates only the posts in the requested category', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'musclog-blog-categories-'));
    temporaryDirectories.push(directory);
    const updatePosts = Array.from({ length: BLOG_POSTS_PER_PAGE + 1 }, (_, index) => ({
      filename: `update-${index + 1}.md`,
      markdown: `---\ntitle: Update ${index + 1}\ndate: 2026-07-${String(index + 1).padStart(2, '0')}\ncategory: updates\ntags: []\n---\nUpdate body.\n`,
    }));

    await Promise.all([
      ...updatePosts.map(({ filename, markdown }) =>
        writeFile(path.join(directory, filename), markdown)
      ),
      writeFile(
        path.join(directory, 'retro.md'),
        '---\ntitle: Retro post\ndate: 2026-06-01\ncategory: retro\ntags: []\n---\nRetro body.\n'
      ),
    ]);

    const summaries = await loadBlogPostSummaries(directory);
    expect(getBlogCategories(summaries)).toEqual(['retro', 'updates']);
    await expect(loadBlogCategories(directory)).resolves.toEqual(['retro', 'updates']);

    const firstPage = await loadBlogCategoryPage('updates', 1, directory);
    const secondPage = await loadBlogCategoryPageForRoute('updates', '2', directory);
    const templatePage = await loadBlogCategoryPageForRoute('[category]', '[page]', directory);

    expect(firstPage).toMatchObject({
      category: 'updates',
      currentPage: 1,
      totalPages: 2,
      totalPosts: BLOG_POSTS_PER_PAGE + 1,
    });
    expect(firstPage.posts).toHaveLength(BLOG_POSTS_PER_PAGE);
    expect(secondPage.posts).toHaveLength(1);
    expect(secondPage.posts.every((post) => post.category === 'updates')).toBe(true);
    expect(templatePage).toMatchObject({ category: 'retro', currentPage: 1, totalPosts: 1 });
  });

  it('counts posts per category and sorts the categories', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'musclog-blog-category-counts-'));
    temporaryDirectories.push(directory);
    const posts: Array<[string, string]> = [
      ['b-one.md', 'updates'],
      ['b-two.md', 'updates'],
      ['b-three.md', 'updates'],
      ['a-retro.md', 'retro'],
      ['c-nutrition.md', 'nutrition'],
    ];

    await Promise.all(
      posts.map(([filename, category], index) =>
        writeFile(
          path.join(directory, filename),
          `---\ntitle: Post ${index}\ndate: 2026-07-${String(index + 1).padStart(2, '0')}\ncategory: ${category}\ntags: []\n---\nBody.\n`
        )
      )
    );

    await expect(loadBlogCategorySummaries(directory)).resolves.toEqual([
      { category: 'nutrition', postCount: 1 },
      { category: 'retro', postCount: 1 },
      { category: 'updates', postCount: 3 },
    ]);
  });

  it('loads configured pages and handles Expo dynamic route templates', async () => {
    const firstPage = await loadBlogPostPage(1);
    const templatePage = await loadBlogPostPageForRoute('[page]');

    expect(firstPage.posts).toHaveLength(Math.min(BLOG_POSTS_PER_PAGE, firstPage.totalPosts));
    expect(templatePage).toEqual(firstPage);
  });

  it('rejects invalid and out-of-range blog pages', async () => {
    await expect(loadBlogPostPageForRoute('0')).rejects.toThrow('Invalid blog page');
    await expect(loadBlogPostPageForRoute('2.5')).rejects.toThrow('Invalid blog page');
    await expect(loadBlogPostPage(999)).rejects.toThrow('Blog page 999 does not exist');
    await expect(loadBlogCategoryPage('../updates', 1)).rejects.toThrow('Invalid blog category');
    await expect(loadBlogCategoryPage('not-a-category', 1)).rejects.toThrow(
      'Blog category not-a-category does not exist'
    );
  });

  it('rejects invalid required metadata with the source path', () => {
    expect(() =>
      parseBlogPostSummary(
        '---\ntitle: Missing fields\ndate: tomorrow\ncategory: development\ntags: [Expo]\n---\nBody',
        '2026/08/broken.md'
      )
    ).toThrow('Invalid blog frontmatter in 2026/08/broken.md: "date" must use YYYY-MM-DD');

    expect(() =>
      parseBlogPostSummary(
        '---\ntitle: Bad category\ndate: 2026-08-09\ncategory: Product updates\ntags: []\n---\nBody',
        '2026/08/bad-category.md'
      )
    ).toThrow(
      'Invalid blog frontmatter in 2026/08/bad-category.md: "category" must be a lowercase, kebab-case translation key'
    );
  });

  it('rejects path traversal in post slugs', async () => {
    await expect(loadBlogPost(['..', 'secrets'])).rejects.toThrow('Invalid blog post slug');
  });
});
