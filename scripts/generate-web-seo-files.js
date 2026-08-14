#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * Generates public/robots.txt, public/sitemap.xml and public/llms.txt before
 * each web export, so all three stay in sync with what actually ships. Runs
 * alongside sync-web-images.js in the web pipelines (see package.json).
 *
 * Fixed routes are derived from components/website/websiteRoutes.json — the
 * same registry components/website/WebsiteSeo.tsx reads for titles, canonical
 * URLs and robots directives. Blog post and category sitemap paths are derived
 * from the Markdown files that generate those dynamic routes.
 */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const blogConfig = require('../components/website/blogConfig.json');
const websiteRoutes = require('../components/website/websiteRoutes.json');

const SITE_ORIGIN = 'https://musclog.app';
const BLOG_POSTS_DIRECTORY = path.join(path.resolve(__dirname, '..'), 'app', '(website)', 'posts');
const MARKDOWN_EXTENSION = /\.md$/i;
const SAFE_SLUG_SEGMENT = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i;
const SAFE_CATEGORY_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BLOG_POSTS_PER_PAGE = blogConfig.postsPerPage;

// Order the llms.txt sections appear in. A route naming a section outside this
// list is a typo, and fails the build rather than vanishing from the output.
const LLMS_SECTIONS = ['Product', 'Support & Policies', 'Source & Extras'];

// Non-route entries for llms.txt, keyed by the section they belong to.
const LLMS_EXTERNAL_LINKS = {
  'Source & Extras': [
    {
      title: 'GitHub Repository',
      summary: 'Full source code, issues, and license (open-source).',
      url: 'https://github.com/blopa/musclog-app',
    },
  ],
};

const LLMS_INTRO = [
  '> Musclog is a free, open-source, local-first fitness and nutrition tracker for Android, iOS, and web. It logs workouts, tracks macros with AI photo/barcode meal recognition, and charts progress — all with data stored privately on-device rather than in the cloud.',
  '',
  'Musclog is built and maintained in the open; the full source is on GitHub. This file summarizes the public marketing site at https://musclog.app for AI assistants and agents — for the product itself, see the Download and FAQ pages below.',
].join('\n');

// AI answer/citation crawlers explicitly allowed so Musclog can be discovered
// and cited by AI assistants and AI-powered search (agentic SEO). All are
// already covered by the default `User-agent: *` allow, but listing them
// explicitly avoids relying on an AI crawler's own default-allow behavior,
// which varies by vendor and changes over time.
const AI_CRAWLER_USER_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
];

/** A route is indexable unless it carries a `robots` directive saying otherwise. */
function isIndexable(route) {
  return !route.robots || !route.robots.includes('noindex');
}

const routes = Object.values(websiteRoutes);
const indexableRoutes = routes.filter(isIndexable);
const noindexRoutes = routes.filter((route) => !isIndexable(route));

function discoverBlogPostFiles(postsDirectory) {
  const files = [];

  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && MARKDOWN_EXTENSION.test(entry.name)) {
        files.push(entryPath);
      }
    }
  }

  visit(postsDirectory);
  return files.sort();
}

function discoverBlogPostPaths(postsDirectory = BLOG_POSTS_DIRECTORY) {
  return discoverBlogPostFiles(postsDirectory).map((file) => {
    const relativePath = path.relative(postsDirectory, file).replaceAll('\\', '/');
    const slug = relativePath.replace(MARKDOWN_EXTENSION, '');
    if (slug.split('/').some((segment) => !SAFE_SLUG_SEGMENT.test(segment))) {
      throw new Error(`Invalid blog post path for a public URL: ${relativePath}`);
    }

    return `/blog/${slug}`;
  });
}

function discoverBlogCategoryPostCounts(postsDirectory = BLOG_POSTS_DIRECTORY) {
  const counts = new Map();

  for (const file of discoverBlogPostFiles(postsDirectory)) {
    const relativePath = path.relative(postsDirectory, file).replaceAll('\\', '/');
    const { category } = matter(fs.readFileSync(file, 'utf8')).data;
    if (typeof category !== 'string' || !SAFE_CATEGORY_KEY.test(category.trim())) {
      throw new Error(
        `Invalid blog category in ${relativePath}: category must be a lowercase, kebab-case translation key`
      );
    }

    const normalizedCategory = category.trim();
    counts.set(normalizedCategory, (counts.get(normalizedCategory) ?? 0) + 1);
  }

  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right))
  );
}

const blogPostPaths = discoverBlogPostPaths();
const blogCategoryPostCounts = discoverBlogCategoryPostCounts();

function blogPaginationPaths(postCount, postsPerPage = BLOG_POSTS_PER_PAGE) {
  if (!Number.isInteger(postsPerPage) || postsPerPage < 1) {
    throw new Error('Blog posts per page must be a positive integer');
  }

  const totalPages = Math.ceil(postCount / postsPerPage);
  return Array.from(
    { length: Math.max(0, totalPages - 1) },
    (_, index) => `/blog/page/${index + 2}`
  );
}

const blogPagePaths = blogPaginationPaths(blogPostPaths.length);

function blogCategoryPaths(categoryPostCounts, postsPerPage = BLOG_POSTS_PER_PAGE) {
  if (!Number.isInteger(postsPerPage) || postsPerPage < 1) {
    throw new Error('Blog posts per page must be a positive integer');
  }

  return Object.entries(categoryPostCounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([category, postCount]) => {
      if (!SAFE_CATEGORY_KEY.test(category) || !Number.isInteger(postCount) || postCount < 1) {
        throw new Error('Blog category counts must use URL-safe categories and positive integers');
      }

      const categoryRoot = `/blog/category/${category}`;
      const totalPages = Math.ceil(postCount / postsPerPage);
      return [
        categoryRoot,
        ...Array.from(
          { length: Math.max(0, totalPages - 1) },
          (_, index) => `${categoryRoot}/page/${index + 2}`
        ),
      ];
    });
}

const blogCategoryPagePaths = blogCategoryPaths(blogCategoryPostCounts);

/**
 * Matches `absoluteUrl` in WebsiteSeo.tsx, so a page's sitemap <loc> is
 * byte-identical to the canonical URL it advertises — including the trailing
 * slash on home, which the previous sitemap dropped.
 */
function absoluteUrl(routePath) {
  return `${SITE_ORIGIN}${routePath}`;
}

function generateRobotsTxt() {
  const disallowLines = noindexRoutes.map((route) => `Disallow: ${route.path}`).join('\n');
  const aiBlocks = AI_CRAWLER_USER_AGENTS.map((agent) => `User-agent: ${agent}\nAllow: /\n`).join(
    '\n'
  );

  return (
    `# Musclog — ${SITE_ORIGIN}\n` +
    '# Auto-generated by scripts/generate-web-seo-files.js — do not edit by hand.\n\n' +
    '# Standard web crawlers\n' +
    'User-agent: *\n' +
    'Allow: /\n' +
    `${disallowLines}\n\n` +
    '# AI assistants / answer engines — explicitly allowed for citation and\n' +
    '# discovery (see /llms.txt for an agent-friendly summary of this site).\n' +
    `${aiBlocks}\n` +
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml\n`
  );
}

/**
 * No <lastmod>: it is optional, search engines largely discount self-reported
 * values, and stamping today's date into a tracked file made every `npm run
 * web` dirty the working tree with a meaningless diff.
 */
function generateSitemapXml() {
  const urls = [
    ...indexableRoutes.map((route) => route.path),
    ...blogPagePaths,
    ...blogCategoryPagePaths,
    ...blogPostPaths,
  ]
    .map((routePath) => `  <url>\n    <loc>${absoluteUrl(routePath)}</loc>\n  </url>`)
    .join('\n');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!-- Auto-generated by scripts/generate-web-seo-files.js — do not edit by hand. -->\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${urls}\n` +
    '</urlset>\n'
  );
}

function generateLlmsTxt() {
  const unknownSections = routes
    .filter((route) => route.llms && !LLMS_SECTIONS.includes(route.llms.section))
    .map((route) => route.llms.section);

  if (unknownSections.length > 0) {
    throw new Error(
      `websiteRoutes.json references unknown llms.txt section(s): ${unknownSections.join(', ')}. ` +
        `Known sections: ${LLMS_SECTIONS.join(', ')}.`
    );
  }

  const sections = LLMS_SECTIONS.map((section) => {
    const links = [
      ...(LLMS_EXTERNAL_LINKS[section] ?? []),
      ...routes
        .filter((route) => route.llms?.section === section)
        .map((route) => ({ ...route.llms, url: absoluteUrl(route.path) })),
    ];

    return `## ${section}\n\n${links
      .map((link) => `- [${link.title}](${link.url}): ${link.summary}`)
      .join('\n')}`;
  });

  return `# Musclog\n\n${LLMS_INTRO}\n\n${sections.join('\n\n')}\n`;
}

function main() {
  const publicDir = path.join(path.resolve(__dirname, '..'), 'public');

  fs.writeFileSync(path.join(publicDir, 'robots.txt'), generateRobotsTxt());
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), generateSitemapXml());
  fs.writeFileSync(path.join(publicDir, 'llms.txt'), generateLlmsTxt());

  console.log(
    '[generate-web-seo-files] wrote public/robots.txt, public/sitemap.xml and public/llms.txt',
    `(${indexableRoutes.length + blogPagePaths.length + blogCategoryPagePaths.length + blogPostPaths.length} indexable routes)`
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  blogCategoryPaths,
  blogPaginationPaths,
  discoverBlogCategoryPostCounts,
  discoverBlogPostPaths,
  generateSitemapXml,
};
