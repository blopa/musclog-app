import { useLoaderData } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { createStaticLoader } from 'expo-router/server';

import { BlogListingPage } from '@/components/website/BlogListingPage';
import { blogTagSeo, metadataForPage } from '@/components/website/websiteMetadata';

export async function generateStaticParams(): Promise<{ page: string; tag: string }[]> {
  const { getBlogTagSummaries, loadBlogPostSummaries, paginateBlogPosts, postsWithTag } =
    await import('@/utils/blogPosts.server');
  const posts = await loadBlogPostSummaries();

  return getBlogTagSummaries(posts).flatMap(({ tag }) => {
    const { totalPages } = paginateBlogPosts(postsWithTag(posts, tag), 1);

    // Page 1 is the tag root, which is its own route — see `blogRoutes.js`.
    return Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => ({
      page: String(index + 2),
      tag,
    }));
  });
}

export const loader = createStaticLoader(async (params) => {
  const { loadBlogTagPageForRoute } = await import('@/utils/blogPosts.server');
  return loadBlogTagPageForRoute(params.tag, params.page);
});

export default function PaginatedBlogTag() {
  return <BlogListingPage {...useLoaderData<typeof loader>()} />;
}

export const generateMetadata: GenerateMetadataFunction = async (_request, params) => {
  const { loadBlogTagPageForRoute } = await import('@/utils/blogPosts.server');
  const { tag, tagLabel } = await loadBlogTagPageForRoute(params.tag, params.page);
  return metadataForPage(blogTagSeo(Number(params.page), tag, tagLabel));
};
