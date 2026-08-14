import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Folder,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { getBlogPaginationItems } from '@/utils/blogPagination';
import type { BlogPostPage } from '@/utils/blogPosts.server';

import { GridPattern } from './WebsiteBackgrounds';
import { BODY_TEXT, BODY_TEXT_SOFT, BRAND_GREEN_BRIGHT } from './websiteColors';

function formatPostDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function pageHref(page: number, category?: string): string {
  if (category) {
    return page === 1 ? `/blog/category/${category}` : `/blog/category/${category}/page/${page}`;
  }

  return page === 1 ? '/blog' : `/blog/page/${page}`;
}

const paginationLinkClass =
  'inline-flex min-w-32 items-center justify-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-5 py-3 text-sm font-bold transition hover:border-emerald-300/50 hover:bg-emerald-400/[0.14] hover:text-emerald-200';

const disabledPaginationClass =
  'inline-flex min-w-32 items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-bold opacity-40';

interface BlogPostListingProps extends BlogPostPage {
  category?: string;
}

export function BlogPostListing({
  category,
  currentPage,
  posts,
  totalPages,
}: BlogPostListingProps) {
  const { i18n, t } = useTranslation(undefined, { keyPrefix: 'website.blog' });
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const categoryLabel = category ? t(`categories.${category}`) : null;
  const previousPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;
  const paginationItems = getBlogPaginationItems(currentPage, totalPages);

  return (
    <main className="relative min-h-[70vh] overflow-hidden pb-24 pt-28">
      <GridPattern className="text-emerald-400/10" />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[760px] -translate-x-1/2 rounded-full blur-[150px]"
        style={{ backgroundColor: 'rgba(0, 255, 163, 0.10)' }}
        aria-hidden="true"
      />

      <div className="container relative z-10 mx-auto max-w-4xl px-4">
        {category ? (
          <a
            href="/blog"
            className="mb-8 inline-flex items-center gap-2 text-sm font-bold transition-colors hover:text-emerald-200"
            style={{ color: BRAND_GREEN_BRIGHT }}
          >
            <ArrowLeft className="h-4 w-4" color="currentColor" />
            {t('backToBlog')}
          </a>
        ) : null}

        <header className="mx-auto mb-14 max-w-3xl text-center">
          <p
            className="mb-4 text-sm font-bold uppercase tracking-[0.24em]"
            style={{ color: BRAND_GREEN_BRIGHT }}
          >
            {category ? t('categoryPage.eyebrow') : t('eyebrow')}
          </p>
          <h1 className="text-balance text-4xl font-extrabold text-white md:text-6xl">
            {category ? t('categoryPage.title', { category: categoryLabel }) : t('title')}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg" style={{ color: BODY_TEXT }}>
            {category
              ? t('categoryPage.description', { category: categoryLabel })
              : t('description')}
          </p>
        </header>

        {posts.length === 0 ? (
          <p
            className="border-white/12 rounded-3xl border border-dashed px-6 py-16 text-center"
            style={{ color: BODY_TEXT_SOFT }}
          >
            {category ? t('categoryPage.empty', { category: categoryLabel }) : t('empty')}
          </p>
        ) : (
          <section
            className="grid gap-5"
            aria-label={
              category ? t('categoryPage.listLabel', { category: categoryLabel }) : t('listLabel')
            }
          >
            {posts.map((post) => (
              <article
                key={post.slug}
                className="group relative rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.015] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.24)] backdrop-blur-sm transition duration-200 hover:border-emerald-400/40 hover:from-white/[0.09] hover:shadow-[0_28px_80px_rgba(0,0,0,0.34)] md:p-8"
              >
                <div
                  className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold uppercase tracking-[0.14em]"
                  style={{ color: BODY_TEXT_SOFT }}
                >
                  <time dateTime={post.date} className="inline-flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5" color={BRAND_GREEN_BRIGHT} />
                    {formatPostDate(post.date, locale)}
                  </time>
                  <span className="h-1 w-1 rounded-full bg-white/25" aria-hidden="true" />
                  <a
                    href={`/blog/category/${post.category}`}
                    className="relative z-10 inline-flex items-center gap-2 transition-colors hover:text-emerald-200"
                  >
                    <Folder className="h-3.5 w-3.5" color={BRAND_GREEN_BRIGHT} />
                    {t(`categories.${post.category}`)}
                  </a>
                </div>

                <h2 className="text-balance text-2xl font-bold leading-tight md:text-[2rem]">
                  {/* Plain anchors preserve inherited HTML typography and hover colors here. */}
                  <a
                    href={`/blog/${post.slug}`}
                    className="text-white transition-colors group-hover:text-emerald-300"
                  >
                    {post.title}
                    <span className="absolute inset-0 rounded-3xl" aria-hidden="true" />
                  </a>
                </h2>

                {post.excerpt ? (
                  <p className="mt-3 line-clamp-3 leading-relaxed" style={{ color: BODY_TEXT }}>
                    {post.excerpt}
                  </p>
                ) : null}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
                  {post.tags.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2" aria-label={t('tagsLabel')}>
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: 'rgba(34,197,94,0.09)',
                            borderColor: 'rgba(34,197,94,0.24)',
                            color: '#A7F3D0',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span />
                  )}

                  <span
                    className="inline-flex items-center gap-2 text-sm font-bold transition-transform duration-200 group-hover:translate-x-1"
                    style={{ color: BRAND_GREEN_BRIGHT }}
                  >
                    {t('readArticle')}
                    <ArrowRight className="h-4 w-4" color="currentColor" />
                  </span>
                </div>
              </article>
            ))}
          </section>
        )}

        {totalPages > 1 ? (
          <nav
            className="mt-10 flex flex-col items-center justify-between gap-4 sm:flex-row"
            aria-label={t('paginationLabel')}
          >
            {previousPage == null ? (
              <span className={disabledPaginationClass} style={{ color: BODY_TEXT_SOFT }}>
                <ChevronLeft className="h-4 w-4" color="currentColor" />
                {t('previousPage')}
              </span>
            ) : (
              <a
                href={pageHref(previousPage, category)}
                rel="prev"
                className={paginationLinkClass}
                style={{ color: BRAND_GREEN_BRIGHT }}
              >
                <ChevronLeft className="h-4 w-4" color="currentColor" />
                {t('previousPage')}
              </a>
            )}

            <div className="flex items-center justify-center gap-2">
              <span className="sr-only">
                {t('pageStatus', { current: currentPage, total: totalPages })}
              </span>
              {paginationItems.map((item) => {
                if (typeof item !== 'number') {
                  return (
                    <span
                      key={item}
                      className="w-5 text-center text-sm"
                      style={{ color: BODY_TEXT_SOFT }}
                      aria-hidden="true"
                    >
                      …
                    </span>
                  );
                }

                return item === currentPage ? (
                  <span
                    key={item}
                    aria-current="page"
                    aria-label={t('pageLabel', { page: item })}
                    className="inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-extrabold text-black"
                    style={{ backgroundColor: BRAND_GREEN_BRIGHT }}
                  >
                    {item}
                  </span>
                ) : (
                  <a
                    key={item}
                    href={pageHref(item, category)}
                    aria-label={t('pageLabel', { page: item })}
                    className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-white/10 px-3 text-sm font-bold transition hover:border-emerald-300/50 hover:bg-emerald-400/[0.12] hover:text-emerald-200"
                    style={{ color: BODY_TEXT }}
                  >
                    {item}
                  </a>
                );
              })}
            </div>

            {nextPage == null ? (
              <span className={disabledPaginationClass} style={{ color: BODY_TEXT_SOFT }}>
                {t('nextPage')}
                <ChevronRight className="h-4 w-4" color="currentColor" />
              </span>
            ) : (
              <a
                href={pageHref(nextPage, category)}
                rel="next"
                className={paginationLinkClass}
                style={{ color: BRAND_GREEN_BRIGHT }}
              >
                {t('nextPage')}
                <ChevronRight className="h-4 w-4" color="currentColor" />
              </a>
            )}
          </nav>
        ) : null}
      </div>
    </main>
  );
}
