import { type Href, Link, useLoaderData } from 'expo-router';
import { createStaticLoader } from 'expo-router/server';
import { ArrowRight, CalendarDays, Folder, Tags } from 'lucide-react-native';
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

      <div className="container relative z-10 mx-auto max-w-5xl px-4">
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
            className="rounded-2xl border px-6 py-12 text-center"
            style={{ borderColor: 'rgba(255,255,255,0.1)', color: BODY_TEXT_SOFT }}
          >
            {t('empty')}
          </p>
        ) : (
          <section className="grid gap-6" aria-label={t('listLabel')}>
            {posts.map((post) => (
              <article
                key={post.slug}
                className="group rounded-3xl border p-6 shadow-2xl backdrop-blur-sm transition-colors hover:border-emerald-400/30 md:p-8"
                style={{
                  background:
                    'linear-gradient(145deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)',
                  borderColor: 'rgba(255,255,255,0.11)',
                  boxShadow: '0 22px 70px rgba(0,0,0,0.24)',
                }}
              >
                <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
                  <time
                    dateTime={post.date}
                    className="inline-flex items-center gap-2"
                    style={{ color: BODY_TEXT_SOFT }}
                  >
                    <CalendarDays className="h-4 w-4" color={BRAND_GREEN_BRIGHT} />
                    {formatPostDate(post.date, locale)}
                  </time>
                  <span
                    className="inline-flex items-center gap-2"
                    style={{ color: BODY_TEXT_SOFT }}
                  >
                    <Folder className="h-4 w-4" color={BRAND_GREEN_BRIGHT} />
                    {post.category}
                  </span>
                </div>

                <h2 className="text-balance text-2xl font-bold leading-tight text-white md:text-3xl">
                  <Link
                    href={`/blog/${post.slug}` as Href}
                    className="transition-colors group-hover:text-emerald-300"
                  >
                    {post.title}
                  </Link>
                </h2>
                {post.excerpt ? (
                  <p className="mt-4 leading-relaxed" style={{ color: BODY_TEXT }}>
                    {post.excerpt}
                  </p>
                ) : null}

                {post.tags.length > 0 ? (
                  <div
                    className="mt-6 flex flex-wrap items-center gap-2"
                    aria-label={t('tagsLabel')}
                  >
                    <Tags className="mr-1 h-4 w-4" color={BODY_TEXT_SOFT} />
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border px-3 py-1 text-xs font-semibold"
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
                ) : null}

                <Link
                  href={`/blog/${post.slug}` as Href}
                  aria-label={`${t('readArticle')}: ${post.title}`}
                  className="mt-7 inline-flex items-center gap-2 text-sm font-bold transition-colors hover:text-emerald-200"
                  style={{ color: BRAND_GREEN_BRIGHT }}
                >
                  {t('readArticle')}
                  <ArrowRight className="h-4 w-4" color="currentColor" />
                </Link>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
