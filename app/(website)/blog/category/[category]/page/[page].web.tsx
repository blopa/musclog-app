import { useLoaderData } from 'expo-router';
import { createStaticLoader } from 'expo-router/server';

import { BlogCategoryPage } from '@/components/website/BlogCategoryPage';

export async function generateStaticParams(): Promise<{ category: string; page: string }[]> {
  const { getBlogCategories, loadBlogPostSummaries, paginateBlogPosts } =
    await import('@/utils/blogPosts.server');
  const posts = await loadBlogPostSummaries();

  return getBlogCategories(posts).flatMap((category) => {
    const categoryPosts = posts.filter((post) => post.category === category);
    const { totalPages } = paginateBlogPosts(categoryPosts, 1);

    return Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => ({
      category,
      page: String(index + 2),
    }));
  });
}

export const loader = createStaticLoader(async (params) => {
  const { loadBlogCategoryPageForRoute } = await import('@/utils/blogPosts.server');
  return loadBlogCategoryPageForRoute(params.category, params.page);
});

export default function PaginatedBlogCategory() {
  return <BlogCategoryPage {...useLoaderData<typeof loader>()} />;
}
