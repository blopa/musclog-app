import { useLoaderData } from 'expo-router';
import { createStaticLoader } from 'expo-router/server';

import { BlogCategoryPage } from '@/components/website/BlogCategoryPage';

export async function generateStaticParams(): Promise<{ category: string }[]> {
  const { loadBlogCategories } = await import('@/utils/blogPosts.server');
  const categories = await loadBlogCategories();

  return categories.map((category) => ({ category }));
}

export const loader = createStaticLoader(async (params) => {
  const { loadBlogCategoryPageForRoute } = await import('@/utils/blogPosts.server');
  return loadBlogCategoryPageForRoute(params.category, 1);
});

export default function BlogCategory() {
  return <BlogCategoryPage {...useLoaderData<typeof loader>()} />;
}
