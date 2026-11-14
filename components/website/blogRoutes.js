/**
 * The one definition of the blog's public URL shapes, its pagination arithmetic, and the two
 * patterns a slug/category must match to be able to form a stable public URL.
 *
 * Four things need these facts and must never disagree about them: the Expo Router loaders
 * (`utils/blogPosts.server.ts`), the sitemap generator (`scripts/generate-web-seo-files.js`), and
 * the two listing components that render links. The generator is CommonJS and runs outside the app
 * bundle, which is why this is a `.js` module rather than TypeScript — the same reason
 * `blogConfig.json` and `websiteRoutes.json` are plain data files both sides can read.
 *
 * `AGENTS.md` already forbids the generator from carrying its own copy of the fixed route list;
 * this extends that rule to the derived blog routes, where a second copy would let the sitemap
 * advertise pages the router does not build (or miss pages it does).
 *
 * Page numbers are 1-based, and page 1 is always the bare path — `/blog`, not `/blog/page/1` — so
 * one post's canonical URL cannot be reached two ways.
 */

const blogConfig = require('./blogConfig.json');

const BLOG_POSTS_PER_PAGE = blogConfig.postsPerPage;

/** A path segment that can appear in a post URL. Underscores allowed; case-insensitive. */
const SAFE_SLUG_SEGMENT = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i;

/** A category key: lowercase kebab-case, because it doubles as a translation key. */
const SAFE_CATEGORY_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * How many listing pages a post count produces. Always at least one: an empty blog still renders
 * `/blog`, and treating that as "zero pages" makes every caller special-case it.
 */
function totalBlogPages(postCount, postsPerPage = BLOG_POSTS_PER_PAGE) {
  if (!Number.isInteger(postsPerPage) || postsPerPage < 1) {
    throw new Error('Blog posts per page must be a positive integer');
  }

  if (!Number.isInteger(postCount) || postCount < 0) {
    throw new Error('Blog post count must be a non-negative integer');
  }

  return Math.max(1, Math.ceil(postCount / postsPerPage));
}

/** The canonical URL of a validated post slug. */
function blogPostPath(slug) {
  return `/blog/${slug}`;
}

/** `/blog`, `/blog/page/2`, … */
function blogPagePath(page) {
  return page === 1 ? '/blog' : `/blog/page/${page}`;
}

/** The page listing every category. Same prefix as the category pages, with no key after it. */
const BLOG_CATEGORIES_PATH = '/blog/category';

/** `/blog/category/retro`, `/blog/category/retro/page/2`, … */
function blogCategoryPath(category, page = 1) {
  const root = `${BLOG_CATEGORIES_PATH}/${category}`;
  return page === 1 ? root : `${root}/page/${page}`;
}

/** The listing URL for a page of all posts, or of one category. */
function blogListingPath(page, category) {
  return category ? blogCategoryPath(category, page) : blogPagePath(page);
}

/** The page listing every tag, as a cloud. Same prefix as the tag pages, with no slug after it. */
const BLOG_TAGS_PATH = '/blog/tag';

/**
 * The URL slug of a free-text tag: lowercase ASCII letters and digits joined by single hyphens,
 * diacritics folded (`Café` -> `cafe`, `1RM calculator` -> `1rm-calculator`). Case variants of one
 * tag ("Open Source", "open source") therefore share one page. Returns `''` for a tag with nothing
 * URL-safe in it, which callers must reject rather than link to.
 */
function blogTagSlug(tag) {
  return String(tag)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `/blog/tag/expo`, `/blog/tag/expo/page/2`, … `tag` is already a slug (see `blogTagSlug`). */
function blogTagPath(tag, page = 1) {
  const root = `${BLOG_TAGS_PATH}/${tag}`;
  return page === 1 ? root : `${root}/page/${page}`;
}

/**
 * Every listing path a post count produces AFTER the first one.
 *
 * The first page is excluded because it is already in the caller's fixed-route registry (`/blog`)
 * or is emitted alongside the category root; listing it here too would duplicate it in the sitemap.
 */
function blogPagePathsAfterFirst(postCount, postsPerPage = BLOG_POSTS_PER_PAGE, category) {
  const pageCount = totalBlogPages(postCount, postsPerPage);
  return Array.from({ length: pageCount - 1 }, (_, index) => blogListingPath(index + 2, category));
}

/** Every listing path of one tag AFTER the first, for the same reason as `blogPagePathsAfterFirst`. */
function blogTagPagePathsAfterFirst(postCount, postsPerPage = BLOG_POSTS_PER_PAGE, tag) {
  const pageCount = totalBlogPages(postCount, postsPerPage);
  return Array.from({ length: pageCount - 1 }, (_, index) => blogTagPath(tag, index + 2));
}

module.exports = {
  BLOG_CATEGORIES_PATH,
  BLOG_POSTS_PER_PAGE,
  BLOG_TAGS_PATH,
  blogCategoryPath,
  blogListingPath,
  blogPagePath,
  blogPostPath,
  blogPagePathsAfterFirst,
  blogTagPagePathsAfterFirst,
  blogTagPath,
  blogTagSlug,
  SAFE_CATEGORY_KEY,
  SAFE_SLUG_SEGMENT,
  totalBlogPages,
};
