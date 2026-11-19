import { readFileSync } from 'fs';
import { join } from 'path';

import {
  blogListingSeo,
  blogTagSeo,
  fixedPageMetadata,
  fixedPageSeo,
  metadataForPage,
  websiteCopy,
} from '../websiteMetadata';
import { WEBSITE_LOCALES, localizedPath } from '../localeRoutes';
import routes from '../websiteRoutes.json';

describe('SDK 58 website metadata', () => {
  it.each(Object.entries(routes))('exports canonical metadata for the %s route', (key, route) => {
    const metadata = fixedPageMetadata(key as keyof typeof routes);
    expect(metadata.title).toBeTruthy();
    expect(metadata.description).toBeTruthy();
    expect(metadata.alternates?.canonical).toBe(
      `https://musclog.app${localizedPath(route.path, 'en')}`
    );
    expect(metadata.openGraph?.url).toBe(metadata.alternates?.canonical);
    expect(metadata.twitter?.card).toBe('summary_large_image');
    expect(metadata.robots).toBe('robots' in route ? route.robots : 'index, follow');
  });

  it('uses the same translated fixed-page data for client metadata', () => {
    expect(metadataForPage(fixedPageSeo('home', 'nl-nl'), 'nl-nl').title).toBe(
      websiteCopy('nl-nl').seo.routes.home.title
    );
  });

  it('uses canonical pagination paths and distinct category page titles', () => {
    const category = Object.keys(websiteCopy().blog.categories)[0];
    expect(blogListingSeo(1, category).canonicalPath).toBe(`/blog/category/${category}`);
    expect(blogListingSeo(2, category).canonicalPath).toBe(`/blog/category/${category}/page/2`);
    expect(blogListingSeo(2, category).title).not.toBe(blogListingSeo(1, category).title);
    expect(blogListingSeo(2).canonicalPath).toBe('/blog/page/2');
  });

  it('gives a tag listing its own canonical path, label and a distinct title per page', () => {
    const first = blogTagSeo(1, 'one-rep-max', 'One-rep max');
    expect(first.canonicalPath).toBe('/blog/tag/one-rep-max');
    expect(first.title).toContain('One-rep max');
    expect(first.keywords).toContain('One-rep max');
    expect(blogTagSeo(2, 'one-rep-max', 'One-rep max').canonicalPath).toBe(
      '/blog/tag/one-rep-max/page/2'
    );
    expect(blogTagSeo(2, 'one-rep-max', 'One-rep max').title).not.toBe(first.title);
  });

  it('gives the tags index its own canonical path and copy in every locale', () => {
    for (const language of ['en-us', 'es-es', 'nl-nl', 'pt-br', 'ru-ru'] as const) {
      const seo = fixedPageSeo('blogTags', language);
      expect(seo.canonicalPath).toBe('/blog/tag');
      expect(seo.title).toBeTruthy();
      expect(seo.description).toBeTruthy();
    }
  });

  it('gives the categories index its own canonical path and copy in every locale', () => {
    for (const language of ['en-us', 'es-es', 'nl-nl', 'pt-br', 'ru-ru'] as const) {
      const seo = fixedPageSeo('blogCategories', language);
      expect(seo.canonicalPath).toBe('/blog/category');
      expect(seo.title).toBeTruthy();
      expect(seo.description).toBeTruthy();
    }
  });

  it('preserves article metadata and uses route-level metadata exports', () => {
    const metadata = metadataForPage({
      title: 'Post',
      description: 'Excerpt',
      canonicalPath: '/blog/post',
      date: '2026-10-17',
      category: 'Development',
      tags: ['expo'],
    });
    expect(metadata.openGraph).toMatchObject({
      type: 'article',
      publishedTime: '2026-10-17T00:00:00.000Z',
      section: 'Development',
      tags: ['expo'],
    });
    const root = join(__dirname, '../../..');
    for (const route of Object.values(routes)) {
      // A listing that has child routes is served from its folder's index file.
      const file =
        route.path === '/'
          ? 'index'
          : ['/blog', '/blog/category', '/blog/tag', '/tools', '/programs'].includes(route.path)
            ? `${route.path.slice(1)}/index`
            : route.path.slice(1);
      if (file === 'test') {
        continue;
      }
      // `/open` is the one page that stays outside the language folder (its exact address is claimed
      // by the app's link settings).
      const scope = 'locales' in route ? route.locales : 'all';
      const folder = scope === 'none' ? '' : scope === 'en' ? 'en/' : '[locale]/';
      expect(readFileSync(join(root, `app/(website)/${folder}${file}.web.tsx`), 'utf8')).toMatch(
        /export (function|const) generateMetadata/
      );
    }
  });
});

describe('website metadata per locale', () => {
  const translatedKeys = (Object.keys(routes) as (keyof typeof routes)[]).filter(
    (key) => !('locales' in routes[key])
  );

  it.each(WEBSITE_LOCALES)('gives $prefix pages a self-referencing canonical', (locale) => {
    for (const key of translatedKeys) {
      const metadata = fixedPageMetadata(key, locale.language);
      expect(metadata.alternates?.canonical).toBe(
        `https://musclog.app${localizedPath(routes[key].path, locale.prefix)}`
      );
      expect(metadata.openGraph?.url).toBe(metadata.alternates?.canonical);
      expect(metadata.openGraph?.locale).toBe(locale.ogLocale);
    }
  });

  it('gives every translated page the same reciprocal hreflang set with x-default', () => {
    for (const key of translatedKeys) {
      const sets = WEBSITE_LOCALES.map((locale) =>
        JSON.stringify(fixedPageMetadata(key, locale.language).alternates?.languages)
      );
      expect(new Set(sets).size).toBe(1);
      const languages = fixedPageMetadata(key).alternates?.languages as Record<string, string>;
      expect(Object.keys(languages).sort()).toEqual(
        [...WEBSITE_LOCALES.map((locale) => locale.hreflang), 'x-default'].sort()
      );
      expect(languages['x-default']).toBe(languages.en);
      for (const locale of WEBSITE_LOCALES) {
        expect(languages[locale.hreflang]).toBe(
          `https://musclog.app${localizedPath(routes[key].path, locale.prefix)}`
        );
      }
    }
  });

  it("uses each locale's own copy for the title", () => {
    expect(fixedPageMetadata('toolProteinCalculator', 'es-ES').title).toBe(
      websiteCopy('es-es').seo.routes.toolProteinCalculator.title
    );
    expect(fixedPageMetadata('toolProteinCalculator', 'es-ES').title).not.toBe(
      fixedPageMetadata('toolProteinCalculator', 'en-US').title
    );
  });

  it('gives English-only blog pages one English canonical and no alternates, in any language', () => {
    for (const language of ['en-US', 'es-ES', 'pt-BR', 'ru-RU']) {
      const post = metadataForPage(
        {
          title: 'Post',
          description: 'x',
          canonicalPath: '/blog/2026/08/post',
          date: '2026-08-01',
        },
        language
      );
      expect(post.alternates?.canonical).toBe('https://musclog.app/en/blog/2026/08/post');
      expect(post.alternates?.languages).toBeUndefined();
      expect(post.openGraph?.locale).toBe('en_US');
      expect(fixedPageMetadata('blog', language).alternates?.languages).toBeUndefined();
      expect(blogListingSeo(2).canonicalPath).toBe('/blog/page/2');
    }
  });

  it('leaves the unprefixed pages unprefixed and without alternates', () => {
    for (const key of ['open', 'test'] as const) {
      const metadata = fixedPageMetadata(key, 'es-ES');
      expect(metadata.alternates?.canonical).toBe(`https://musclog.app${routes[key].path}`);
      expect(metadata.alternates?.languages).toBeUndefined();
    }
  });
});
