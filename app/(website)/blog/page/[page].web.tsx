import { useLoaderData } from 'expo-router';
import { createStaticLoader } from 'expo-router/server';

import { BlogPostListing } from '@/components/website/BlogPostListing';
import { WebsiteSeo } from '@/components/website/WebsiteSeo';

export async function generateStaticParams(): Promise<{ page: string }[]> {
  const { loadBlogPostPage } = await import('@/utils/blogPosts.server');
  const { totalPages } = await loadBlogPostPage(1);

  return Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => ({
    page: String(index + 2),
  }));
}

export const loader = createStaticLoader(async (params) => {
  const { loadBlogPostPageForRoute } = await import('@/utils/blogPosts.server');
  return loadBlogPostPageForRoute(params.page);
});

export default function PaginatedBlog() {
  const page = useLoaderData<typeof loader>();
  const canonicalPath = page.currentPage === 1 ? '/blog' : `/blog/page/${page.currentPage}`;

  return (
    <>
      <WebsiteSeo canonicalPath={canonicalPath} routeKey="blog" />
      <BlogPostListing {...page} />
    </>
  );
}
