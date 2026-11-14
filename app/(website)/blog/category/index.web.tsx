import { useLoaderData } from 'expo-router';
import { createStaticLoader } from 'expo-router/server';

import { BlogCategoriesPage } from '@/components/website/BlogCategoriesPage';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';

export const loader = createStaticLoader(async () => {
  const { loadBlogCategorySummaries } = await import('@/utils/blogPosts.server');
  return { categories: await loadBlogCategorySummaries() };
});

export default function BlogCategories() {
  return <BlogCategoriesPage {...useLoaderData<typeof loader>()} />;
}

export function generateMetadata() {
  return fixedPageMetadata('blogCategories');
}
