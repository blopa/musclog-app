import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Folder,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { getBlogPaginationItems } from '@/utils/blogPagination';
import type { BlogPostPage } from '@/utils/blogPosts.server';

import { useBlogListingCopy } from './blogListingCopy';
import { blogCategoryPath, blogListingPath } from './blogRoutes';
import { GridPattern } from './WebsiteBackgrounds';
import { BODY_TEXT, BODY_TEXT_SOFT, brand, BRAND_GREEN_BRIGHT, brandBright } from './websiteColors';

function formatPostDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

const paginationLinkClass =
  'inline-flex min-w-32 items-center justify-center gap-2 rounded-full border border-accent-bright/25 bg-accent-bright/[0.08] px-5 py-3 text-sm font-bold transition hover:border-accent-bright/50 hover:bg-accent-bright/[0.14] hover:text-accent-pale';

const disabledPaginationClass =
  'inline-flex min-w-32 items-center justify-center gap-2 rounded-full border border-ink/10 px-5 py-3 text-sm font-bold opacity-40';

/**
 * A previous/next control, rendered as a dead label when there is no such page. Both ends are the
 * same control with the chevron on the other side, so they share one implementation rather than
 * two mirrored JSX blocks that have to be kept in visual sync.
 */
function PaginationStep({
  href,
  label,
  rel,
  side,
}: {
  href: null | string;
  label: string;
  rel: 'next' | 'prev';
  side: 'left' | 'right';
}) {
  const chevron: ReactNode =
    side === 'left' ? (
      <ChevronLeft className="h-4 w-4" color="currentColor" />
    ) : (
      <ChevronRight className="h-4 w-4" color="currentColor" />
    );
  const content = (
    <>
      {side === 'left' ? chevron : null}
      {label}
      {side === 'right' ? chevron : null}
    </>
  );

  if (href == null) {
    return (
      <span className={disabledPaginationClass} style={{ color: BODY_TEXT_SOFT }}>
        {content}
      </span>
    );
  }

  return (
    <a href={href} rel={rel} className={paginationLinkClass} style={{ color: BRAND_GREEN_BRIGHT }}>
      {content}
    </a>
  );
}

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
  const copy = useBlogListingCopy(category);
  const previousPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;
  const paginationItems = getBlogPaginationItems(currentPage, totalPages);

  return (
    <main className="relative min-h-[70vh] overflow-hidden pb-24 pt-28">
      <GridPattern className="text-accent-bright/10" />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[760px] -translate-x-1/2 rounded-full blur-[150px]"
        style={{ backgroundColor: brandBright(0.1) }}
        aria-hidden="true"
      />

      <div className="container relative z-10 mx-auto max-w-4xl px-4">
        {category ? (
          <a
            href="/blog"
            className="mb-8 inline-flex items-center gap-2 text-sm font-bold transition-colors hover:text-accent-pale"
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
            {copy.eyebrow}
          </p>
          <h1 className="text-balance text-4xl font-extrabold text-text-primary md:text-6xl">
            {copy.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg" style={{ color: BODY_TEXT }}>
            {copy.description}
          </p>
        </header>

        {posts.length === 0 ? (
          <p
            className="border-ink/12 rounded-3xl border border-dashed px-6 py-16 text-center"
            style={{ color: BODY_TEXT_SOFT }}
          >
            {copy.empty}
          </p>
        ) : (
          <section className="grid gap-5" aria-label={copy.listLabel}>
            {posts.map((post) => (
              <article
                key={post.slug}
                className="group relative rounded-3xl border border-ink/10 bg-gradient-to-br from-ink/[0.06] to-ink/[0.015] p-6 shadow-[0_22px_70px_rgb(var(--c-scrim-base)/0.24)] backdrop-blur-sm transition duration-200 hover:border-accent-bright/40 hover:from-ink/[0.09] hover:shadow-[0_28px_80px_rgb(var(--c-scrim-base)/0.34)] md:p-8"
              >
                <div
                  className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold uppercase tracking-[0.14em]"
                  style={{ color: BODY_TEXT_SOFT }}
                >
                  <time dateTime={post.date} className="inline-flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5" color={BRAND_GREEN_BRIGHT} />
                    {formatPostDate(post.date, locale)}
                  </time>
                  <span className="h-1 w-1 rounded-full bg-ink/25" aria-hidden="true" />
                  <a
                    href={blogCategoryPath(post.category)}
                    className="relative z-10 inline-flex items-center gap-2 transition-colors hover:text-accent-pale"
                  >
                    <Folder className="h-3.5 w-3.5" color={BRAND_GREEN_BRIGHT} />
                    {t(`categories.${post.category}`)}
                  </a>
                </div>

                <h2 className="text-balance text-2xl font-bold leading-tight md:text-[2rem]">
                  {/* Plain anchors preserve inherited HTML typography and hover colors here. */}
                  <a
                    href={`/blog/${post.slug}`}
                    className="text-text-primary transition-colors group-hover:text-accent-bright"
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
                            backgroundColor: brand(0.09),
                            borderColor: brand(0.24),
                            color: BRAND_GREEN_BRIGHT,
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
            <PaginationStep
              href={previousPage == null ? null : blogListingPath(previousPage, category)}
              label={t('previousPage')}
              rel="prev"
              side="left"
            />

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
                    className="inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-extrabold text-text-on-accent"
                    style={{ backgroundColor: BRAND_GREEN_BRIGHT }}
                  >
                    {item}
                  </span>
                ) : (
                  <a
                    key={item}
                    href={blogListingPath(item, category)}
                    aria-label={t('pageLabel', { page: item })}
                    className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-ink/10 px-3 text-sm font-bold transition hover:border-accent-bright/50 hover:bg-accent-bright/[0.12] hover:text-accent-pale"
                    style={{ color: BODY_TEXT }}
                  >
                    {item}
                  </a>
                );
              })}
            </div>

            <PaginationStep
              href={nextPage == null ? null : blogListingPath(nextPage, category)}
              label={t('nextPage')}
              rel="next"
              side="right"
            />
          </nav>
        ) : null}
      </div>
    </main>
  );
}
