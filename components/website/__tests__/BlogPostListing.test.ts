/** @jest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { createElement } from 'react';

import { BlogPostListing } from '@/components/website/BlogPostListing';
import type { BlogPostSummary } from '@/utils/blogPosts.server';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en', resolvedLanguage: 'en' },
    t: (key: string) => key,
  }),
}));
jest.mock('@/components/website/useWebsiteHref', () => ({
  useWebsiteHref: () => (path: string) => `/localized${path}`,
}));
jest.mock('@/components/website/blogListingCopy', () => ({
  useBlogListingCopy: () => ({
    description: 'Listing description',
    empty: 'No posts',
    listLabel: 'Posts',
    title: 'Listing title',
  }),
}));
jest.mock('@/components/website/BlogTagChip', () => ({ BlogTagChip: () => null }));
jest.mock('lucide-react-native', () => ({
  ArrowLeft: () => null,
  ArrowRight: () => null,
  CalendarDays: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
  Folder: () => null,
}));

const highlightedPost: BlogPostSummary = {
  category: 'training',
  date: '2026-11-20',
  excerpt: 'A useful summary of this highlighted post.',
  slug: 'guides/arbitrary-highlight',
  tags: [],
  title: 'An arbitrary highlighted title',
};

const listedPost: BlogPostSummary = {
  category: 'training',
  date: '2026-11-19',
  excerpt: 'A regular listing excerpt.',
  slug: 'guides/regular-post',
  tags: [],
  title: 'A regular post',
};

function renderListing(overrides: Partial<Parameters<typeof BlogPostListing>[0]> = {}) {
  return render(
    createElement(BlogPostListing, {
      currentPage: 1,
      posts: [listedPost],
      totalPages: 2,
      totalPosts: 2,
      ...overrides,
    })
  );
}

describe('BlogPostListing highlighted posts', () => {
  it('shows highlighted posts on the first page of any tag listing with localized post links', () => {
    renderListing({ tag: 'any-tag-slug', highlightedPosts: [highlightedPost] });

    const region = screen.getByRole('region', { name: 'highlightedPosts' });
    const link = within(region).getByRole('link', { name: highlightedPost.title });
    expect(link.getAttribute('href')).toBe('/localized/blog/guides/arbitrary-highlight');
    expect(within(region).getByText(highlightedPost.excerpt).tagName).toBe('P');
    expect(screen.getByRole('link', { name: listedPost.title })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'paginationLabel' })).toBeTruthy();
  });

  it('omits the region when there are no highlighted posts', () => {
    renderListing({ tag: 'any-tag-slug', highlightedPosts: [] });

    expect(screen.queryByRole('region', { name: 'highlightedPosts' })).toBeNull();
  });

  it('omits the region for non-tag listings and later tag pages', () => {
    const { rerender } = renderListing({ highlightedPosts: [highlightedPost] });
    expect(screen.queryByRole('region', { name: 'highlightedPosts' })).toBeNull();

    rerender(
      createElement(BlogPostListing, {
        currentPage: 2,
        highlightedPosts: [highlightedPost],
        posts: [listedPost],
        tag: 'any-tag-slug',
        totalPages: 2,
        totalPosts: 2,
      })
    );
    expect(screen.queryByRole('region', { name: 'highlightedPosts' })).toBeNull();
    expect(screen.getByRole('link', { name: listedPost.title })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'paginationLabel' })).toBeTruthy();
  });
});
