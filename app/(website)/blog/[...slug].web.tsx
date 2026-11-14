import { Link, useLoaderData } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { createStaticLoader } from 'expo-router/server';
import { ArrowLeft, CalendarDays, Folder, Languages, Tags } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { BlogMermaid } from '@/components/website/BlogMermaid';
import { BlogPostShare } from '@/components/website/BlogPostShare';
import { blogPostPath } from '@/components/website/blogRoutes';
import { BlogTagChip } from '@/components/website/BlogTagChip';
import { BODY_TEXT_SOFT, BRAND_GREEN_BRIGHT, hue } from '@/components/website/websiteColors';
import { metadataForPage, websiteCopy } from '@/components/website/websiteMetadata';
import { BlogPostSeo } from '@/components/website/WebsiteSeo';
import { BlogPostingJsonLd } from '@/components/website/WebsiteStructuredData';
import { useBlogGalleries } from '@/hooks/useBlogGalleries';

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
  useBlogGalleries('blog-post-body', post.slug);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const canonicalPath = blogPostPath(post.slug);
  const category = t(`categories.${post.category}`);
  // The site chrome is translated, the posts themselves are not — so every non-English reader gets
  // told that up front, in their own language, instead of hitting a wall of English mid-scroll.
  const isEnglish = locale.toLowerCase().startsWith('en');

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
        <article className="container relative z-10 mx-auto max-w-4xl px-4">
          <Link
            href="/blog"
            className="mb-10 inline-flex items-center gap-2 text-sm font-bold text-accent-bright transition-colors hover:text-accent-pale"
          >
            <ArrowLeft className="h-4 w-4" color="currentColor" />
            {t('backToBlog')}
          </Link>

          <header className="border-b border-ink/10 pb-10">
            <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
              <time
                dateTime={post.date}
                className="inline-flex items-center gap-2"
                style={{ color: BODY_TEXT_SOFT }}
              >
                <CalendarDays className="h-4 w-4" color={BRAND_GREEN_BRIGHT} />
                {formatPostDate(post.date, locale)}
              </time>
              <span style={{ color: BODY_TEXT_SOFT }}>
                <a
                  href={`/blog/category/${post.category}`}
                  className="inline-flex items-center gap-2 transition-colors hover:text-accent-pale"
                >
                  <Folder className="h-4 w-4" color={BRAND_GREEN_BRIGHT} />
                  {category}
                </a>
              </span>
            </div>

            <h1 className="text-balance text-4xl font-bold leading-tight text-text-primary md:text-6xl">
              {post.title}
            </h1>

            {post.tags.length > 0 ? (
              <div className="mt-7 flex flex-wrap items-center gap-2" aria-label={t('tagsLabel')}>
                <Tags className="mr-1 h-4 w-4" color={BODY_TEXT_SOFT} />
                {post.tags.map((tag) => (
                  <BlogTagChip key={tag} tag={tag} className="px-3" />
                ))}
              </div>
            ) : null}
          </header>

          {!isEnglish ? (
            <p
              role="note"
              className="mt-10 flex items-center gap-3 rounded-control border px-4 py-3 text-sm font-medium"
              style={{
                backgroundColor: hue('amber', 0.08),
                borderColor: hue('amber', 0.24),
                color: hue('amber'),
              }}
            >
              <Languages className="h-4 w-4 shrink-0" color="currentColor" />
              {t('englishOnlyNotice')}
            </p>
          ) : null}

          <div
            id="blog-post-body"
            className="blog-prose py-10"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />
          <BlogMermaid containerId="blog-post-body" />

          <footer className="border-t border-ink/10 pt-8">
            <BlogPostShare
              canonicalPath={canonicalPath}
              description={post.excerpt}
              title={post.title}
            />

            <Link
              href="/blog"
              className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-accent-bright transition-colors hover:text-accent-pale"
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

export const generateMetadata: GenerateMetadataFunction = async (_request, params) => {
  const { loadBlogPostForRoute } = await import('@/utils/blogPosts.server');
  const post = await loadBlogPostForRoute(params.slug);
  const copy = websiteCopy();
  return metadataForPage({
    title: `${post.title} | ${copy.seo.siteName}`,
    description: post.excerpt || post.title,
    canonicalPath: blogPostPath(post.slug),
    date: post.date,
    category:
      copy.blog.categories[post.category as keyof typeof copy.blog.categories] ?? post.category,
    tags: post.tags,
    keywords: [copy.seo.keywords, ...post.tags].join(', '),
  });
};
