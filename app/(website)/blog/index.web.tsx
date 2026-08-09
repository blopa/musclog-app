import { useLoaderData } from 'expo-router';
import { createStaticLoader } from 'expo-router/server';
import { ArrowRight, CalendarDays, Folder } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { GridPattern } from '@/components/website/WebsiteBackgrounds';
import { BODY_TEXT, BODY_TEXT_SOFT, BRAND_GREEN_BRIGHT } from '@/components/website/websiteColors';

export const loader = createStaticLoader(async () => {
  const { loadBlogPostSummaries } = await import('@/utils/blogPosts.server');
  return loadBlogPostSummaries();
});

function formatPostDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export default function Blog() {
  const posts = useLoaderData<typeof loader>();
  const { i18n, t } = useTranslation(undefined, { keyPrefix: 'website.blog' });
  const locale = i18n.resolvedLanguage ?? i18n.language;

  return (
    <main className="relative min-h-[70vh] overflow-hidden pb-24 pt-28">
      <GridPattern className="text-emerald-400/10" />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[760px] -translate-x-1/2 rounded-full blur-[150px]"
        style={{ backgroundColor: 'rgba(0, 255, 163, 0.10)' }}
        aria-hidden="true"
      />

      <div className="container relative z-10 mx-auto max-w-4xl px-4">
        <header className="mx-auto mb-14 max-w-3xl text-center">
          <p
            className="mb-4 text-sm font-bold uppercase tracking-[0.24em]"
            style={{ color: BRAND_GREEN_BRIGHT }}
          >
            {t('eyebrow')}
          </p>
          <h1 className="text-balance text-4xl font-extrabold text-white md:text-6xl">
            {t('title')}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg" style={{ color: BODY_TEXT }}>
            {t('description')}
          </p>
        </header>

        {posts.length === 0 ? (
          <p
            className="border-white/12 rounded-3xl border border-dashed px-6 py-16 text-center"
            style={{ color: BODY_TEXT_SOFT }}
          >
            {t('empty')}
          </p>
        ) : (
          <section className="grid gap-5" aria-label={t('listLabel')}>
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
                  <span className="inline-flex items-center gap-2">
                    <Folder className="h-3.5 w-3.5" color={BRAND_GREEN_BRIGHT} />
                    {post.category}
                  </span>
                </div>

                <h2 className="text-balance text-2xl font-bold leading-tight md:text-[2rem]">
                  {/*
                   * A plain anchor, not expo-router's `Link`: on web that renders a
                   * react-native-web `Text`, which neither inherits the heading's color and font
                   * size nor reacts to `group-hover:` — the title used to paint near-black on the
                   * dark card. The stretched span below makes the whole card clickable while
                   * keeping exactly one link per post.
                   */}
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
      </div>
    </main>
  );
}
