import { readFileSync } from 'node:fs';
import path from 'node:path';

import enUsWebsite from '@/lang/locales/en-us/website.json';
import esEsWebsite from '@/lang/locales/es-es/website.json';
import nlNlWebsite from '@/lang/locales/nl-nl/website.json';
import ptBrWebsite from '@/lang/locales/pt-br/website.json';
import ruRuWebsite from '@/lang/locales/ru-ru/website.json';

import { loadBlogPostSummaries } from '../blogPosts.server';

const categoryTranslations = {
  'en-us': enUsWebsite.website.blog.categories,
  'es-es': esEsWebsite.website.blog.categories,
  'nl-nl': nlNlWebsite.website.blog.categories,
  'pt-br': ptBrWebsite.website.blog.categories,
  'ru-ru': ruRuWebsite.website.blog.categories,
};

describe('blog category translations', () => {
  it('renders translated category labels as links to their static category pages', () => {
    const listingSource = readFileSync(
      path.join(process.cwd(), 'components', 'website', 'BlogPostListing.tsx'),
      'utf8'
    );
    const articleSource = readFileSync(
      path.join(process.cwd(), 'app', '(website)', 'blog', '[...slug].web.tsx'),
      'utf8'
    );

    expect(listingSource).toContain('t(`categories.${post.category}`)');
    expect(listingSource).toContain('href={blogCategoryPath(post.category)}');
    expect(articleSource).toContain('const category = t(`categories.${post.category}`);');
    expect(articleSource).toContain('href={`/blog/category/${post.category}`}');
    expect(articleSource.match(/category=\{category\}/g)).toHaveLength(2);
  });

  it('defines static loaders for category indexes and paginated category pages', () => {
    const categoryIndexSource = readFileSync(
      path.join(
        process.cwd(),
        'app',
        '(website)',
        'blog',
        'category',
        '[category]',
        'index.web.tsx'
      ),
      'utf8'
    );
    const categoryPageSource = readFileSync(
      path.join(
        process.cwd(),
        'app',
        '(website)',
        'blog',
        'category',
        '[category]',
        'page',
        '[page].web.tsx'
      ),
      'utf8'
    );

    expect(categoryIndexSource).toContain('generateStaticParams');
    expect(categoryIndexSource).toContain('loadBlogCategoryPageForRoute(params.category)');
    expect(categoryPageSource).toContain('generateStaticParams');
    expect(categoryPageSource).toContain(
      'loadBlogCategoryPageForRoute(params.category, params.page)'
    );
  });

  it('has a non-empty translation for every shipped category in every locale', async () => {
    const posts = await loadBlogPostSummaries();
    const categories = new Set(posts.map((post) => post.category));

    for (const [locale, translations] of Object.entries(categoryTranslations)) {
      for (const category of categories) {
        const translation = translations[category as keyof typeof translations];

        expect({ [locale]: { [category]: translation } }).toEqual({
          [locale]: { [category]: expect.any(String) },
        });
        expect(translation.trim()).not.toBe('');
      }
    }
  });

  it('localizes the category listing copy in every locale', () => {
    for (const website of [enUsWebsite, esEsWebsite, nlNlWebsite, ptBrWebsite, ruRuWebsite]) {
      const categoryPage = website.website.blog.categoryPage;

      expect(Object.keys(categoryPage).sort()).toEqual([
        'description',
        'empty',
        'eyebrow',
        'listLabel',
        'title',
      ]);
      for (const translation of Object.values(categoryPage)) {
        expect(translation.trim()).not.toBe('');
      }
    }
  });
});
