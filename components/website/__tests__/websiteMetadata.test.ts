import { readFileSync } from 'fs';
import { join } from 'path';

import {
  blogListingSeo,
  fixedPageMetadata,
  fixedPageSeo,
  metadataForPage,
  websiteCopy,
} from '../websiteMetadata';
import routes from '../websiteRoutes.json';

describe('SDK 58 website metadata', () => {
  it.each(Object.entries(routes))('exports canonical metadata for the %s route', (key, route) => {
    const metadata = fixedPageMetadata(key as keyof typeof routes);
    expect(metadata.title).toBeTruthy();
    expect(metadata.description).toBeTruthy();
    expect(metadata.alternates?.canonical).toBe(`https://musclog.app${route.path}`);
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
          ? 'home'
          : ['/blog', '/blog/category', '/tools', '/programs'].includes(route.path)
            ? `${route.path.slice(1)}/index`
            : route.path.slice(1);
      if (file === 'test') {
        continue;
      }
      expect(readFileSync(join(root, `app/(website)/${file}.web.tsx`), 'utf8')).toContain(
        'export function generateMetadata'
      );
    }
  });
});
