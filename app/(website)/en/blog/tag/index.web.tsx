import { useLoaderData } from 'expo-router';
import { createStaticLoader } from 'expo-router/server';

import { BlogTagsPage } from '@/components/website/BlogTagsPage';
import { fixedMetadataFor } from '@/components/website/websiteMetadata';

export const loader = createStaticLoader(async () => {
  const { loadBlogTagSummaries } = await import('@/utils/blogPosts.server');
  return { tags: await loadBlogTagSummaries() };
});

export default function BlogTags() {
  return <BlogTagsPage {...useLoaderData<typeof loader>()} />;
}

export const generateMetadata = fixedMetadataFor('blogTags');
