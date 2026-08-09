import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import matter from 'gray-matter';

export interface BlogPostSummary {
  category: string;
  date: string;
  excerpt: string;
  slug: string;
  tags: string[];
  title: string;
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

export function parseBlogPostSummary(markdown: string, relativePath: string): BlogPostSummary {
  const { content, data } = matter(markdown);
  const frontmatter = data as BlogPostFrontmatter;
  const normalizedPath = relativePath.replaceAll('\\', '/');
  const description =
    frontmatter.description == null
      ? excerptFromContent(content)
      : requiredString(frontmatter.description, 'description', normalizedPath);

  return {
    category: requiredString(frontmatter.category, 'category', normalizedPath),
    date: normalizeDate(frontmatter.date, normalizedPath),
    excerpt: description,
    slug: normalizedPath.replace(MARKDOWN_EXTENSION, ''),
    tags: normalizeTags(frontmatter.tags, normalizedPath),
    title: requiredString(frontmatter.title, 'title', normalizedPath),
  };
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

export async function loadBlogPostSummaries(
  postsDirectory = path.join(process.cwd(), 'app', '(website)', 'posts')
): Promise<BlogPostSummary[]> {
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
