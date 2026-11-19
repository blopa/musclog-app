/**
 * Local, offline audit of what the website tells search engines: fixed-route titles and descriptions
 * (English and every other locale), the sitemap, and the blog posts' frontmatter and body. It reads the
 * same sources the build does (components/website/websiteRoutes.json, lang/locales/<locale>/website.json,
 * app/(website)/posts) so it cannot disagree with what ships.
 *
 * Findings are leads, not verdicts: a long title may be fine. The skill weighs them with real search
 * data before changing anything.
 */
const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');

const { REPO_ROOT, SITE_ORIGIN } = require('./config');

// Search results truncate around these widths; the ranges are conventions, not limits.
const TITLE_MAX = 60;
const TITLE_MIN = 15;
const DESCRIPTION_MIN = 70;
const DESCRIPTION_MAX = 160;
const BLOG_TITLE_MAX = 70;
const THIN_POST_WORDS = 300;
const MARKDOWN_EXTENSION = /\.md$/i;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listLocales(root) {
  const base = path.join(root, 'lang', 'locales');

  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && fs.existsSync(path.join(base, entry.name, 'website.json'))
    )
    .map((entry) => entry.name);
}

function routeCopy(root, locale) {
  const file = readJson(path.join(root, 'lang', 'locales', locale, 'website.json'));

  return file?.website?.seo?.routes ?? {};
}

function textFindings(kind, target, locale, title, description) {
  const findings = [];
  const where = locale ? `${target} (${locale})` : target;

  if (!title) {
    findings.push({
      severity: 'warn',
      kind: `${kind}-title-missing`,
      target: where,
      message: 'No title.',
    });
  } else if (title.length > TITLE_MAX) {
    findings.push({
      severity: 'info',
      kind: `${kind}-title-long`,
      target: where,
      message: `Title is ${title.length} characters (about ${TITLE_MAX} fit in a result): "${title}"`,
    });
  } else if (title.length < TITLE_MIN) {
    findings.push({
      severity: 'info',
      kind: `${kind}-title-short`,
      target: where,
      message: `Title is only ${title.length} characters: "${title}"`,
    });
  }

  if (!description) {
    findings.push({
      severity: 'warn',
      kind: `${kind}-description-missing`,
      target: where,
      message: 'No meta description: Google writes its own from the page.',
    });
  } else if (description.length > DESCRIPTION_MAX) {
    findings.push({
      severity: 'info',
      kind: `${kind}-description-long`,
      target: where,
      message: `Description is ${description.length} characters (about ${DESCRIPTION_MAX} show).`,
    });
  } else if (description.length < DESCRIPTION_MIN) {
    findings.push({
      severity: 'info',
      kind: `${kind}-description-short`,
      target: where,
      message: `Description is only ${description.length} characters.`,
    });
  }

  return findings;
}

function auditRoutes(root, sitemapUrls) {
  const routes = readJson(path.join(root, 'components', 'website', 'websiteRoutes.json'));
  const locales = listLocales(root);
  const copyByLocale = Object.fromEntries(
    locales.map((locale) => [locale, routeCopy(root, locale)])
  );
  const english = copyByLocale['en-us'] ?? {};
  const findings = [];
  const titleOwners = new Map();
  const indexable = [];

  for (const [key, route] of Object.entries(routes)) {
    if (route.robots) {
      continue;
    }

    indexable.push({ key, path: route.path });
    findings.push(
      ...textFindings('route', route.path, null, english[key]?.title, english[key]?.description)
    );

    if (english[key]?.title) {
      const owners = titleOwners.get(english[key].title) ?? [];

      owners.push(route.path);
      titleOwners.set(english[key].title, owners);
    }

    for (const locale of locales) {
      if (locale !== 'en-us' && !copyByLocale[locale][key]?.title) {
        findings.push({
          severity: 'warn',
          kind: 'route-locale-missing',
          target: `${route.path} (${locale})`,
          message: 'No translated SEO title for this route.',
        });
      }
    }

    if (
      sitemapUrls &&
      !sitemapUrls.includes(`${SITE_ORIGIN}${route.path === '/' ? '' : route.path}`) &&
      !sitemapUrls.includes(`${SITE_ORIGIN}${route.path}`)
    ) {
      findings.push({
        severity: 'warn',
        kind: 'route-not-in-sitemap',
        target: route.path,
        message: 'Indexable route is not in the sitemap.',
      });
    }
  }

  for (const [title, owners] of titleOwners) {
    if (owners.length > 1) {
      findings.push({
        severity: 'warn',
        kind: 'route-title-duplicate',
        target: owners.join(', '),
        message: `These routes share the title "${title}".`,
      });
    }
  }

  return { findings, indexable, locales };
}

function walkMarkdown(directory) {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkMarkdown(full));
    } else if (MARKDOWN_EXTENSION.test(entry.name)) {
      files.push(full);
    }
  }

  return files;
}

function wordCount(text) {
  return (text.match(/[\p{L}\p{N}']+/gu) ?? []).length;
}

function auditPost(file, postsDirectory) {
  const { data, content } = matter(fs.readFileSync(file, 'utf8'));
  const relative = path
    .relative(postsDirectory, file)
    .replace(/\\/g, '/')
    .replace(MARKDOWN_EXTENSION, '');
  const target = `/blog/${relative}`;
  const findings = [];
  const title = typeof data.title === 'string' ? data.title : '';
  const description = typeof data.description === 'string' ? data.description : '';
  const words = wordCount(content);

  if (!title) {
    findings.push({ severity: 'warn', kind: 'post-title-missing', target, message: 'No title.' });
  } else if (title.length > BLOG_TITLE_MAX) {
    findings.push({
      severity: 'info',
      kind: 'post-title-long',
      target,
      message: `Title is ${title.length} characters: "${title}"`,
    });
  }

  if (!description) {
    findings.push({
      severity: 'warn',
      kind: 'post-description-missing',
      target,
      message:
        'No description: the listing and the search snippet fall back to the first lines of the post.',
    });
  } else if (description.length > DESCRIPTION_MAX + 40) {
    findings.push({
      severity: 'info',
      kind: 'post-description-long',
      target,
      message: `Description is ${description.length} characters; search results cut it near ${DESCRIPTION_MAX}.`,
    });
  }

  if (words < THIN_POST_WORDS) {
    findings.push({ severity: 'info', kind: 'post-thin', target, message: `Only ${words} words.` });
  }

  if (!/\]\((\/|https?:\/\/(www\.)?musclog\.app)/.test(content)) {
    findings.push({
      severity: 'info',
      kind: 'post-no-internal-links',
      target,
      message: 'Links to no other page on the site (no tool, program, exercise or post).',
    });
  }

  if (/!\[\s*\]\(/.test(content)) {
    findings.push({
      severity: 'warn',
      kind: 'post-image-no-alt',
      target,
      message: 'An image has no alt text.',
    });
  }

  return {
    findings,
    post: {
      path: target,
      title,
      category: data.category ?? null,
      tags: Array.isArray(data.tags) ? data.tags : [],
      date: data.date ? String(data.date).slice(0, 10) : null,
      words,
    },
  };
}

function auditBlog(root) {
  const postsDirectory = path.join(root, 'app', '(website)', 'posts');

  if (!fs.existsSync(postsDirectory)) {
    return { findings: [], posts: [] };
  }

  const results = walkMarkdown(postsDirectory).map((file) => auditPost(file, postsDirectory));

  return {
    findings: results.flatMap((result) => result.findings),
    posts: results.map((result) => result.post),
  };
}

/** `<loc>` URLs of a sitemap document. */
function parseSitemapUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1]);
}

function readSitemapUrls(root) {
  const file = path.join(root, 'public', 'sitemap.xml');

  return fs.existsSync(file) ? parseSitemapUrls(fs.readFileSync(file, 'utf8')) : null;
}

function auditSite({ root = REPO_ROOT, sitemapUrls = readSitemapUrls(root) } = {}) {
  const routes = auditRoutes(root, sitemapUrls);
  const blog = auditBlog(root);
  const byCategory = {};

  for (const post of blog.posts) {
    byCategory[post.category ?? 'none'] = (byCategory[post.category ?? 'none'] ?? 0) + 1;
  }

  return {
    findings: [...routes.findings, ...blog.findings],
    stats: {
      sitemapUrls: sitemapUrls ? sitemapUrls.length : null,
      indexableRoutes: routes.indexable.length,
      locales: routes.locales,
      posts: blog.posts.length,
      postsByCategory: byCategory,
    },
    posts: blog.posts,
    sitemapUrls: sitemapUrls ?? [],
  };
}

module.exports = { auditSite, parseSitemapUrls, wordCount };
