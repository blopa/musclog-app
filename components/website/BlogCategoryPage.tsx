import { useTranslation } from 'react-i18next';

import type { BlogCategoryPostPage } from '@/utils/blogPosts.server';

import blogConfig from './blogConfig.json';
import { BlogPostListing } from './BlogPostListing';
import { BlogCategorySeo } from './WebsiteSeo';
import { BlogCategoryJsonLd } from './WebsiteStructuredData';

function categoryPagePath(category: string, page: number): string {
  return page === 1 ? `/blog/category/${category}` : `/blog/category/${category}/page/${page}`;
}

export function BlogCategoryPage(page: BlogCategoryPostPage) {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.blog' });
  const categoryLabel = t(`categories.${page.category}`);
  const categoryTitle = t('categoryPage.title', { category: categoryLabel });
  const title =
    page.currentPage === 1
      ? categoryTitle
      : `${categoryTitle} — ${t('pageLabel', { page: page.currentPage })}`;
  const description = t('categoryPage.description', { category: categoryLabel });
  const canonicalPath = categoryPagePath(page.category, page.currentPage);

  return (
    <>
      <BlogCategorySeo
        canonicalPath={canonicalPath}
        category={categoryLabel}
        description={description}
        title={title}
      />
      <BlogCategoryJsonLd
        canonicalPath={canonicalPath}
        description={description}
        positionOffset={(page.currentPage - 1) * blogConfig.postsPerPage}
        posts={page.posts}
        title={title}
      />
      <BlogPostListing {...page} />
    </>
  );
}
