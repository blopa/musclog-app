import { useTranslation } from 'react-i18next';

import type { BlogPostPage } from '@/utils/blogPosts.server';

import { useBlogListingCopy } from './blogListingCopy';
import { BlogPostListing } from './BlogPostListing';
import { BLOG_POSTS_PER_PAGE, blogListingPath, blogTagPath } from './blogRoutes';
import { BlogCategorySeo, BlogTagSeo, WebsiteSeo } from './WebsiteSeo';
import { BlogListingJsonLd } from './WebsiteStructuredData';

/**
 * A page of the blog index: all posts, one category, or one tag.
 *
 * One component for both because a category listing is the same page with a filter applied —
 * `BlogPostListing` already models it that way with an optional `category`, and the three routes
 * previously composed three different sets of metadata around it (the category pages had SEO plus
 * JSON-LD, `/blog/page/N` had SEO only, and `/blog` had neither).
 *
 * The one asymmetry is deliberate: `/blog` is a fixed route, so its title and description live in
 * `websiteRoutes.json` and `WebsiteSeo` reads them from there. A category has no registry entry —
 * its name is a translated label — so it supplies them explicitly.
 */
export function BlogListingPage({
  category,
  tag,
  tagLabel,
  ...page
}: BlogPostPage & { category?: string; tag?: string; tagLabel?: string }) {
  const { t } = useTranslation();
  const copy = useBlogListingCopy(category, tagLabel);
  const canonicalPath = tag
    ? blogTagPath(tag, page.currentPage)
    : blogListingPath(page.currentPage, category);
  // Page 2 onwards says so in the title, so search results do not show several
  // identically-named entries for one category or tag.
  const title =
    page.currentPage === 1
      ? copy.title
      : `${copy.title} — ${t('website.blog.pageLabel', { page: page.currentPage })}`;

  let seo = <WebsiteSeo canonicalPath={canonicalPath} routeKey="blog" />;
  if (tag && tagLabel) {
    seo = (
      <BlogTagSeo
        canonicalPath={canonicalPath}
        description={copy.description}
        tagLabel={tagLabel}
        title={title}
      />
    );
  } else if (category && copy.categoryLabel) {
    seo = (
      <BlogCategorySeo
        canonicalPath={canonicalPath}
        category={copy.categoryLabel}
        description={copy.description}
        title={title}
      />
    );
  }

  return (
    <>
      {seo}
      <BlogListingJsonLd
        canonicalPath={canonicalPath}
        description={copy.description}
        // Positions are absolute within the whole listing, not within this page, so page 2's
        // first item is item 11 rather than a second item 1.
        positionOffset={(page.currentPage - 1) * BLOG_POSTS_PER_PAGE}
        posts={page.posts}
        title={copy.title}
      />
      <BlogPostListing {...page} category={category} tag={tag} tagLabel={tagLabel} />
    </>
  );
}
