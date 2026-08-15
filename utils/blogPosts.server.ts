import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import matter from 'gray-matter';
import hljs from 'highlight.js/lib/common';
import MarkdownIt from 'markdown-it';

import {
  BLOG_POSTS_PER_PAGE,
  SAFE_CATEGORY_KEY,
  SAFE_SLUG_SEGMENT,
  totalBlogPages,
} from '@/components/website/blogRoutes';

export interface BlogPostSummary {
  category: string;
  date: string;
  excerpt: string;
  slug: string;
  tags: string[];
  title: string;
}

export interface BlogPost extends BlogPostSummary {
  html: string;
}

export interface BlogPostPage {
  currentPage: number;
  posts: BlogPostSummary[];
  totalPages: number;
  totalPosts: number;
}

export interface BlogCategoryPostPage extends BlogPostPage {
  category: string;
}

interface BlogPostFrontmatter {
  category?: unknown;
  date?: unknown;
  description?: unknown;
  tags?: unknown;
  title?: unknown;
}

const MARKDOWN_EXTENSION = /\.md$/i;
const ISO_CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ROUTE_PAGE_NUMBER = /^[1-9]\d*$/;

/** Where posts live, unless a test points the loaders somewhere else. */
const DEFAULT_POSTS_DIRECTORY = path.join(process.cwd(), 'app', '(website)', 'posts');

export { BLOG_POSTS_PER_PAGE };

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const markdownRenderer = new MarkdownIt({
  breaks: false,
  html: false,
  linkify: true,
  typographer: true,
  highlight(code, language) {
    const normalizedLanguage = language.trim().toLowerCase();
    let highlighted = escapeHtml(code);
    if (normalizedLanguage && hljs.getLanguage(normalizedLanguage)) {
      highlighted = hljs.highlight(code, {
        ignoreIllegals: true,
        language: normalizedLanguage,
      }).value;
    }
    const languageClass = normalizedLanguage
      ? ` class="language-${escapeHtml(normalizedLanguage)}"`
      : '';

    return `<pre class="hljs"><code${languageClass}>${highlighted}</code></pre>`;
  },
});

function frontmatterError(relativePath: string, message: string): Error {
  return new Error(`Invalid blog frontmatter in ${relativePath}: ${message}`);
}

function requiredString(value: unknown, field: string, relativePath: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw frontmatterError(relativePath, `"${field}" must be a non-empty string`);
  }

  return value.trim();
}

function normalizeDate(value: unknown, relativePath: string): string {
  const date = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  if (typeof date !== 'string' || !ISO_CALENDAR_DATE.test(date)) {
    throw frontmatterError(relativePath, '"date" must use YYYY-MM-DD');
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw frontmatterError(relativePath, `"date" is not a valid calendar date: ${date}`);
  }

  return date;
}

function normalizeTags(value: unknown, relativePath: string): string[] {
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== 'string' || tag.trim() === '')) {
    throw frontmatterError(relativePath, '"tags" must be an array of non-empty strings');
  }

  return value.map((tag) => tag.trim());
}

function normalizeCategory(value: unknown, relativePath: string): string {
  const category = requiredString(value, 'category', relativePath);
  if (!SAFE_CATEGORY_KEY.test(category)) {
    throw frontmatterError(
      relativePath,
      '"category" must be a lowercase, kebab-case translation key'
    );
  }

  return category;
}

function excerptFromContent(content: string): string {
  const prose = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?)/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (prose.length <= 180) {
    return prose;
  }

  const shortened = prose.slice(0, 181);
  const lastSpace = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, lastSpace > 120 ? lastSpace : 180).trimEnd()}…`;
}

function slugFromRelativePath(relativePath: string): string {
  const normalizedPath = relativePath.replaceAll('\\', '/');
  const slug = normalizedPath.replace(MARKDOWN_EXTENSION, '');
  const segments = slug.split('/');

  if (segments.some((segment) => !SAFE_SLUG_SEGMENT.test(segment))) {
    throw frontmatterError(
      normalizedPath,
      'file and directory names must contain only letters, numbers, hyphens, or underscores'
    );
  }

  return slug;
}

function normalizedSlug(slug: string | string[]): string {
  const segments = Array.isArray(slug) ? slug : slug.split('/');
  if (segments.length === 0 || segments.some((segment) => !SAFE_SLUG_SEGMENT.test(segment))) {
    throw new Error('Invalid blog post slug');
  }

  return segments.join('/');
}

export function parseBlogPostSummary(markdown: string, relativePath: string): BlogPostSummary {
  const { content, data } = matter(markdown);
  const frontmatter = data as BlogPostFrontmatter;
  const normalizedPath = relativePath.replaceAll('\\', '/');
  const description =
    frontmatter.description == null
      ? excerptFromContent(content)
      : requiredString(frontmatter.description, 'description', normalizedPath);

  return {
    category: normalizeCategory(frontmatter.category, normalizedPath),
    date: normalizeDate(frontmatter.date, normalizedPath),
    excerpt: description,
    slug: slugFromRelativePath(normalizedPath),
    tags: normalizeTags(frontmatter.tags, normalizedPath),
    title: requiredString(frontmatter.title, 'title', normalizedPath),
  };
}

export function renderBlogPostMarkdown(markdown: string): string {
  return markdownRenderer.render(markdown);
}

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return markdownFiles(entryPath);
      }

      return entry.isFile() && MARKDOWN_EXTENSION.test(entry.name) ? [entryPath] : [];
    })
  );

  return files.flat();
}

async function readBlogPostSummaries(postsDirectory: string): Promise<BlogPostSummary[]> {
  const files = await markdownFiles(postsDirectory);
  const posts = await Promise.all(
    files.map(async (file) => {
      const relativePath = path.relative(postsDirectory, file);
      return parseBlogPostSummary(await readFile(file, 'utf8'), relativePath);
    })
  );

  return posts.sort((left, right) => {
    const dateOrder = right.date.localeCompare(left.date);
    return dateOrder !== 0 ? dateOrder : left.title.localeCompare(right.title);
  });
}

/**
 * One parse of the corpus per directory, for the life of the process.
 *
 * Every route below starts by reading every post: the index, each of N listing pages, each of M
 * category pages, and both `generateStaticParams` passes. Without this, a static export re-walks
 * the directory and re-runs `gray-matter` over every file once per generated page — and
 * `loadBlogCategoryPageForRoute` did it twice for a single page, since resolving the category and
 * paginating it each started from scratch.
 *
 * Safe because these loaders only ever run in a build/test process, where the Markdown cannot
 * change underneath us: the app ships the rendered HTML, not the parser (see the Metro stub rule
 * in `AGENTS.md`). The cache is keyed by directory so a test pointing at a temporary folder never
 * sees another test's posts.
 */
const summariesByDirectory = new Map<string, Promise<BlogPostSummary[]>>();

export function loadBlogPostSummaries(
  postsDirectory = DEFAULT_POSTS_DIRECTORY
): Promise<BlogPostSummary[]> {
  const cached = summariesByDirectory.get(postsDirectory);
  if (cached) {
    return cached;
  }

  // Cached as the promise, not the result, so concurrent loaders share one directory walk.
  // Dropped again on failure, so a transient read error is not remembered forever.
  const pending = readBlogPostSummaries(postsDirectory).catch((error: unknown) => {
    summariesByDirectory.delete(postsDirectory);
    throw error;
  });
  summariesByDirectory.set(postsDirectory, pending);

  return pending;
}

export function getBlogCategories(posts: BlogPostSummary[]): string[] {
  return [...new Set(posts.map((post) => post.category))].sort((left, right) =>
    left.localeCompare(right)
  );
}

export async function loadBlogCategories(
  postsDirectory = DEFAULT_POSTS_DIRECTORY
): Promise<string[]> {
  return getBlogCategories(await loadBlogPostSummaries(postsDirectory));
}

export function paginateBlogPosts(
  posts: BlogPostSummary[],
  currentPage: number,
  postsPerPage = BLOG_POSTS_PER_PAGE
): BlogPostPage {
  if (!Number.isInteger(currentPage) || currentPage < 1) {
    throw new Error('Blog page must be a positive integer');
  }

  // Page count comes from `blogRoutes.js`, the same arithmetic the sitemap generator uses, so a
  // page this rejects can never appear in sitemap.xml (or vice versa).
  const totalPages = totalBlogPages(posts.length, postsPerPage);
  if (currentPage > totalPages) {
    throw new Error(`Blog page ${currentPage} does not exist`);
  }

  const start = (currentPage - 1) * postsPerPage;

  return {
    currentPage,
    posts: posts.slice(start, start + postsPerPage),
    totalPages,
    totalPosts: posts.length,
  };
}

/**
 * A dynamic route parameter as a single string.
 *
 * Expo's static manifest evaluates the UNRESOLVED route template too, so every loader is also
 * called once with the literal segment (`[page]`, `[category]`, `[...slug]`) alongside the paths
 * `generateStaticParams` returned. `templateFallback` is what that call renders instead — the
 * loaders below cannot simply reject it, or the export fails.
 */
function resolveRouteParam(
  value: string | string[],
  template: string,
  templateFallback: string
): string {
  const joined = Array.isArray(value) ? value.join('/') : value;
  return joined === template ? templateFallback : joined;
}

/** A `page` route segment as a 1-based page number, rejecting anything that is not one. */
function routePageNumber(page: string | string[], invalidMessage: string): number {
  const resolved = resolveRouteParam(page, '[page]', '1');
  if (!ROUTE_PAGE_NUMBER.test(resolved)) {
    throw new Error(invalidMessage);
  }

  return Number(resolved);
}

export async function loadBlogPostPage(
  currentPage: number,
  postsDirectory = DEFAULT_POSTS_DIRECTORY
): Promise<BlogPostPage> {
  return paginateBlogPosts(await loadBlogPostSummaries(postsDirectory), currentPage);
}

export async function loadBlogPostPageForRoute(
  page: string | string[],
  postsDirectory = DEFAULT_POSTS_DIRECTORY
): Promise<BlogPostPage> {
  return loadBlogPostPage(routePageNumber(page, 'Invalid blog page'), postsDirectory);
}

export async function loadBlogCategoryPage(
  category: string,
  currentPage: number,
  postsDirectory = DEFAULT_POSTS_DIRECTORY
): Promise<BlogCategoryPostPage> {
  if (!SAFE_CATEGORY_KEY.test(category)) {
    throw new Error('Invalid blog category');
  }

  const categoryPosts = (await loadBlogPostSummaries(postsDirectory)).filter(
    (post) => post.category === category
  );
  if (categoryPosts.length === 0) {
    throw new Error(`Blog category ${category} does not exist`);
  }

  return {
    category,
    ...paginateBlogPosts(categoryPosts, currentPage),
  };
}

/**
 * Route parameters straight from Expo, both optional-shaped for the same reason: the category
 * index route has no `page` segment at all, and either segment may arrive as the unresolved
 * template. Deliberately NOT `number | string | string[]` — the one caller that used to pass a
 * literal `1` was the category index, which now just omits the argument.
 */
export async function loadBlogCategoryPageForRoute(
  category: string | string[],
  page: string | string[] = '1',
  postsDirectory = DEFAULT_POSTS_DIRECTORY
): Promise<BlogCategoryPostPage> {
  const [firstCategory] = await loadBlogCategories(postsDirectory);
  const resolvedCategory = resolveRouteParam(category, '[category]', firstCategory ?? '');
  if (!resolvedCategory) {
    throw new Error('Cannot render the static blog category template without any categories');
  }

  return loadBlogCategoryPage(
    resolvedCategory,
    routePageNumber(page, 'Invalid blog category page'),
    postsDirectory
  );
}

export async function loadBlogPost(
  slug: string | string[],
  postsDirectory = DEFAULT_POSTS_DIRECTORY
): Promise<BlogPost> {
  const postSlug = normalizedSlug(slug);
  const relativePath = `${postSlug}.md`;
  const markdown = await readFile(
    path.join(postsDirectory, ...postSlug.split('/')) + '.md',
    'utf8'
  );
  const { content } = matter(markdown);

  return {
    ...parseBlogPostSummary(markdown, relativePath),
    html: renderBlogPostMarkdown(content),
  };
}

export async function loadBlogPostForRoute(
  slug: string | string[],
  postsDirectory = DEFAULT_POSTS_DIRECTORY
): Promise<BlogPost> {
  const [firstPost] = await loadBlogPostSummaries(postsDirectory);
  const resolvedSlug = resolveRouteParam(slug, '[...slug]', firstPost?.slug ?? '');
  if (!resolvedSlug) {
    throw new Error('Cannot render the static blog route template without any posts');
  }

  return loadBlogPost(resolvedSlug, postsDirectory);
}
