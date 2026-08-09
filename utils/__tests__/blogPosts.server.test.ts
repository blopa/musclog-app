import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  loadBlogPost,
  loadBlogPostForRoute,
  loadBlogPostSummaries,
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

  it('loads and renders a post body without exposing Markdown to the client', async () => {
    const post = await loadBlogPost(
      '2026/08/using-decimen-optical-transfer-foss-to-transfer-data-between-devices'
    );

    expect(post.html).toContain('<p>Lorem ipsum dolor sit amet.</p>');
    expect(post.html).toContain('<pre class="hljs"><code class="language-javascript">');
    expect(post.html).toContain('<span class="hljs-keyword">const</span>');
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
