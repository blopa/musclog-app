import { useLoaderData } from 'expo-router';
import { createStaticLoader } from 'expo-router/server';

import { BlogPostListing } from '@/components/website/BlogPostListing';

export const loader = createStaticLoader(async () => {
  const { loadBlogPostPage } = await import('@/utils/blogPosts.server');
  return loadBlogPostPage(1);
});

export default function Blog() {
  return <BlogPostListing {...useLoaderData<typeof loader>()} />;
}
