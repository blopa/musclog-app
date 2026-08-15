import { useLoaderData } from 'expo-router';
import { createStaticLoader } from 'expo-router/server';

import { BlogListingPage } from '@/components/website/BlogListingPage';

export async function generateStaticParams(): Promise<{ page: string }[]> {
  const { loadBlogPostPage } = await import('@/utils/blogPosts.server');
  const { totalPages } = await loadBlogPostPage(1);

  // Page 1 is `/blog`, which is its own route — see `blogRoutes.js`.
  return Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => ({
    page: String(index + 2),
  }));
}

export const loader = createStaticLoader(async (params) => {
  const { loadBlogPostPageForRoute } = await import('@/utils/blogPosts.server');
  return loadBlogPostPageForRoute(params.page);
});

export default function PaginatedBlog() {
  return <BlogListingPage {...useLoaderData<typeof loader>()} />;
}
