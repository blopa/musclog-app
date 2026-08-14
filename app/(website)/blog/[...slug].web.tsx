import { Link, useLoaderData } from 'expo-router';
import { createStaticLoader } from 'expo-router/server';
import { ArrowLeft, CalendarDays, Folder, Tags } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { GridPattern } from '@/components/website/WebsiteBackgrounds';
import { BODY_TEXT_SOFT, BRAND_GREEN_BRIGHT } from '@/components/website/websiteColors';
import { BlogPostSeo } from '@/components/website/WebsiteSeo';
import { BlogPostingJsonLd } from '@/components/website/WebsiteStructuredData';

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const { loadBlogPostSummaries } = await import('@/utils/blogPosts.server');
  const posts = await loadBlogPostSummaries();

  return posts.map((post) => ({ slug: post.slug }));
}

export const loader = createStaticLoader(async (params) => {
  const { loadBlogPostForRoute } = await import('@/utils/blogPosts.server');
  return loadBlogPostForRoute(params.slug);
});

function formatPostDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export default function BlogPostPage() {
  const post = useLoaderData<typeof loader>();
  const { i18n, t } = useTranslation(undefined, { keyPrefix: 'website.blog' });
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const canonicalPath = `/blog/${post.slug}`;
  const category = t(`categories.${post.category}`);

  return (
    <>
      <BlogPostSeo
        canonicalPath={canonicalPath}
        category={category}
        date={post.date}
        description={post.excerpt}
        tags={post.tags}
        title={post.title}
      />
      <BlogPostingJsonLd
        canonicalPath={canonicalPath}
        category={category}
        date={post.date}
        description={post.excerpt}
        tags={post.tags}
        title={post.title}
      />

      <main className="relative min-h-[70vh] overflow-hidden pb-24 pt-24 md:pt-28">
        <GridPattern className="text-emerald-400/[0.06]" />
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full blur-[160px]"
          style={{ backgroundColor: 'rgba(0, 255, 163, 0.08)' }}
          aria-hidden="true"
        />

        <article className="container relative z-10 mx-auto max-w-4xl px-4">
          <Link
            href="/blog"
            className="mb-10 inline-flex items-center gap-2 text-sm font-bold transition-colors hover:text-emerald-200"
            style={{ color: BRAND_GREEN_BRIGHT }}
          >
            <ArrowLeft className="h-4 w-4" color="currentColor" />
            {t('backToBlog')}
          </Link>

          <header className="border-b border-white/10 pb-10">
            <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
              <time
                dateTime={post.date}
                className="inline-flex items-center gap-2"
                style={{ color: BODY_TEXT_SOFT }}
              >
                <CalendarDays className="h-4 w-4" color={BRAND_GREEN_BRIGHT} />
                {formatPostDate(post.date, locale)}
              </time>
              <span className="inline-flex items-center gap-2" style={{ color: BODY_TEXT_SOFT }}>
                <Folder className="h-4 w-4" color={BRAND_GREEN_BRIGHT} />
                {category}
              </span>
            </div>

            <h1 className="text-balance text-4xl font-extrabold leading-tight text-white md:text-6xl">
              {post.title}
            </h1>

            {post.tags.length > 0 ? (
              <div className="mt-7 flex flex-wrap items-center gap-2" aria-label={t('tagsLabel')}>
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
          </header>

          <div className="blog-prose py-10" dangerouslySetInnerHTML={{ __html: post.html }} />

          <footer className="border-t border-white/10 pt-8">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-bold transition-colors hover:text-emerald-200"
              style={{ color: BRAND_GREEN_BRIGHT }}
            >
              <ArrowLeft className="h-4 w-4" color="currentColor" />
              {t('backToBlog')}
            </Link>
          </footer>
        </article>
      </main>
    </>
  );
}
