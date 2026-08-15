/**
 * Native stub for "utils/blogPosts.server".
 *
 * The blog loaders read Markdown off disk with `node:fs/promises`, so they only ever run on
 * web (static export / server data loaders). They still reach the native graph, because
 * expo-router's native `require.context` regex matches `app/(website)/blog/*.web.tsx` and
 * Metro resolves their `await import()` statically. Metro resolves this stub instead so the
 * Node built-ins — and gray-matter / markdown-it / highlight.js — stay out of the app bundle.
 *
 * Nothing on native reaches these: the native route siblings are redirects to /app, and
 * `loader` / `generateStaticParams` are web-only entry points. Throwing keeps a mistaken
 * call loud instead of silently returning empty posts.
 */
const unavailable = (name) => () => {
  throw new Error(`${name} is web-only and cannot run on native.`);
};

module.exports = {
  getBlogCategories: unavailable('getBlogCategories'),
  loadBlogCategories: unavailable('loadBlogCategories'),
  loadBlogCategoryPage: unavailable('loadBlogCategoryPage'),
  loadBlogCategoryPageForRoute: unavailable('loadBlogCategoryPageForRoute'),
  loadBlogPost: unavailable('loadBlogPost'),
  loadBlogPostForRoute: unavailable('loadBlogPostForRoute'),
  loadBlogPostPage: unavailable('loadBlogPostPage'),
  loadBlogPostPageForRoute: unavailable('loadBlogPostPageForRoute'),
  loadBlogPostSummaries: unavailable('loadBlogPostSummaries'),
  paginateBlogPosts: unavailable('paginateBlogPosts'),
  parseBlogPostSummary: unavailable('parseBlogPostSummary'),
  renderBlogPostMarkdown: unavailable('renderBlogPostMarkdown'),
};
