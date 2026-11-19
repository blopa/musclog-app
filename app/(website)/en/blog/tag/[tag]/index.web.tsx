import { useLoaderData } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { createStaticLoader } from 'expo-router/server';

import { BlogListingPage } from '@/components/website/BlogListingPage';
import { blogTagSeo, metadataForPage } from '@/components/website/websiteMetadata';

export async function generateStaticParams(): Promise<{ tag: string }[]> {
  const { loadBlogTagSummaries } = await import('@/utils/blogPosts.server');
  const tags = await loadBlogTagSummaries();

  return tags.map(({ tag }) => ({ tag }));
}

export const loader = createStaticLoader(async (params) => {
  const { loadBlogTagPageForRoute } = await import('@/utils/blogPosts.server');
  return loadBlogTagPageForRoute(params.tag);
});

export default function BlogTag() {
  return <BlogListingPage {...useLoaderData<typeof loader>()} />;
}

// The tag's label is free text from the posts, so it is read from the same loader the page uses.
export const generateMetadata: GenerateMetadataFunction = async (_request, params) => {
  const { loadBlogTagPageForRoute } = await import('@/utils/blogPosts.server');
  const { tag, tagLabel } = await loadBlogTagPageForRoute(params.tag);
  return metadataForPage(blogTagSeo(1, tag, tagLabel));
};
