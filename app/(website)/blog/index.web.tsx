import { useLoaderData } from 'expo-router';
import { createStaticLoader } from 'expo-router/server';

import { BlogListingPage } from '@/components/website/BlogListingPage';

export const loader = createStaticLoader(async () => {
  const { loadBlogPostPage } = await import('@/utils/blogPosts.server');
  return loadBlogPostPage(1);
});

export default function Blog() {
  return <BlogListingPage {...useLoaderData<typeof loader>()} />;
}
