import { ArrowLeft, ArrowRight, Folder } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { BlogCategorySummary } from '@/utils/blogPosts.server';

import { blogCategoryPath, blogPagePath } from './blogRoutes';
import { BODY_TEXT, BODY_TEXT_SOFT, BRAND_GREEN_BRIGHT } from './websiteColors';
import { WebsiteSeo } from './WebsiteSeo';

/**
 * `/blog/category`: every category of the blog with its article count, each linking to that
 * category's listing. The set comes from the posts' own frontmatter (`loadBlogCategorySummaries`),
 * so a new category appears here as soon as a post uses it.
 */
export function BlogCategoriesPage({ categories }: { categories: BlogCategorySummary[] }) {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.blog' });

  return (
    <>
      <WebsiteSeo routeKey="blogCategories" />
      <main className="relative min-h-[70vh] overflow-hidden pb-24 pt-28">
        <div className="container relative z-10 mx-auto max-w-4xl px-4">
          <a
            href={blogPagePath(1)}
            className="mb-8 inline-flex items-center gap-2 text-sm font-bold transition-colors hover:text-accent-pale"
            style={{ color: BRAND_GREEN_BRIGHT }}
          >
            <ArrowLeft className="h-4 w-4" color="currentColor" />
            {t('backToBlog')}
          </a>

          <header className="mx-auto mb-14 max-w-3xl text-center">
            <p className="mb-4 text-sm font-bold" style={{ color: BRAND_GREEN_BRIGHT }}>
              {t('categoriesPage.eyebrow')}
            </p>
            <h1 className="text-balance text-4xl font-bold text-text-primary md:text-6xl">
              {t('categoriesPage.title')}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-lg" style={{ color: BODY_TEXT }}>
              {t('categoriesPage.description')}
            </p>
          </header>

          <ul className="grid gap-5 sm:grid-cols-2" aria-label={t('categoriesPage.listLabel')}>
            {categories.map(({ category, postCount }) => (
              <li key={category}>
                <a
                  href={blogCategoryPath(category)}
                  className="group flex h-full items-center justify-between gap-4 rounded-card border border-ink/10 p-6 transition-colors hover:border-accent-bright/40"
                >
                  <span className="flex min-w-0 flex-col gap-2">
                    <span className="inline-flex items-center gap-2 text-xl font-bold text-text-primary transition-colors group-hover:text-accent-bright">
                      <Folder className="h-5 w-5 shrink-0" color={BRAND_GREEN_BRIGHT} />
                      {t(`categories.${category}`)}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: BODY_TEXT_SOFT }}>
                      {t('categoriesPage.postCount', { count: postCount })}
                    </span>
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                    color={BRAND_GREEN_BRIGHT}
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}
