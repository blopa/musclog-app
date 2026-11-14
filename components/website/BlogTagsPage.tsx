import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { BlogTagSummary } from '@/utils/blogPosts.server';
import { TAG_CLOUD_LEVELS, tagCloudLevel } from '@/utils/blogTagCloud';

import { blogPagePath, blogTagPath } from './blogRoutes';
import { BODY_TEXT, BODY_TEXT_SOFT, BRAND_GREEN_BRIGHT } from './websiteColors';
import { WebsiteSeo } from './WebsiteSeo';

/**
 * Type size per cloud step, smallest to biggest. Written out in full so Tailwind sees every class;
 * a step built from a template string would never be generated.
 */
const TAG_SIZE_CLASSES = ['text-sm', 'text-lg', 'text-2xl', 'text-4xl', 'text-5xl'] as const;

/**
 * `/blog/tag`: every tag of the blog as a cloud, the more articles carry a tag the bigger it is.
 * The set comes from the posts' own frontmatter (`loadBlogTagSummaries`), so a new tag appears here
 * as soon as a post uses it. The article count is in the markup (and the tooltip) as well as the
 * size, so the ranking is never conveyed by size alone.
 */
export function BlogTagsPage({ tags }: { tags: BlogTagSummary[] }) {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.blog' });
  const counts = tags.map((tag) => tag.postCount);
  const min = Math.min(...counts);
  const max = Math.max(...counts);

  return (
    <>
      <WebsiteSeo routeKey="blogTags" />
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
              {t('tagsPage.eyebrow')}
            </p>
            <h1 className="text-balance text-4xl font-bold text-text-primary md:text-6xl">
              {t('tagsPage.title')}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-lg" style={{ color: BODY_TEXT }}>
              {t('tagsPage.description')}
            </p>
          </header>

          <ul
            className="flex flex-wrap items-baseline justify-center gap-x-6 gap-y-4"
            aria-label={t('tagsPage.listLabel')}
          >
            {tags.map(({ label, postCount, tag }) => {
              const level = tagCloudLevel(postCount, min, max);
              const countLabel = t('tagsPage.postCount', { count: postCount });

              return (
                <li key={tag}>
                  <a
                    href={blogTagPath(tag)}
                    title={countLabel}
                    className={`${TAG_SIZE_CLASSES[Math.min(level, TAG_CLOUD_LEVELS - 1)]} font-bold leading-tight text-text-primary transition-colors hover:text-accent-bright`}
                  >
                    {label}
                    <span className="ml-1 text-xs font-semibold" style={{ color: BODY_TEXT_SOFT }}>
                      <span aria-hidden="true">{postCount}</span>
                      <span className="sr-only">{countLabel}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </>
  );
}
