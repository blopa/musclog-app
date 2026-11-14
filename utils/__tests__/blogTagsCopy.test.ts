import enUsWebsite from '@/lang/locales/en-us/website.json';
import esEsWebsite from '@/lang/locales/es-es/website.json';
import nlNlWebsite from '@/lang/locales/nl-nl/website.json';
import ptBrWebsite from '@/lang/locales/pt-br/website.json';
import ruRuWebsite from '@/lang/locales/ru-ru/website.json';

const locales = {
  'en-us': enUsWebsite,
  'es-es': esEsWebsite,
  'nl-nl': nlNlWebsite,
  'pt-br': ptBrWebsite,
  'ru-ru': ruRuWebsite,
} as const;

describe('blog tags copy', () => {
  it.each(Object.entries(locales))(
    '%s has the tag routes, back-link and page strings',
    (_, copy) => {
      const website = copy.website as Record<string, unknown>;
      const seo = (website.seo as Record<string, Record<string, unknown>>).routes;
      const blog = website.blog as Record<string, unknown>;

      const route = seo.blogTags as Record<string, unknown>;
      expect(typeof route.title).toBe('string');
      expect((route.title as string).length).toBeGreaterThan(0);
      expect(typeof route.description).toBe('string');
      expect((route.description as string).length).toBeGreaterThan(0);

      expect(typeof blog.backToTags).toBe('string');
      expect((blog.backToTags as string).length).toBeGreaterThan(0);
      expect(typeof blog.browseTags).toBe('string');
      expect((blog.browseTags as string).length).toBeGreaterThan(0);

      const tagsPage = blog.tagsPage as Record<string, unknown>;
      for (const key of ['title', 'description', 'eyebrow', 'listLabel']) {
        expect(typeof tagsPage[key]).toBe('string');
        expect((tagsPage[key] as string).length).toBeGreaterThan(0);
      }
      expect(tagsPage.postCount_other).toContain('{{count}}');

      const tagPage = blog.tagPage as Record<string, unknown>;
      for (const key of ['title', 'description', 'empty', 'listLabel', 'eyebrow']) {
        expect(typeof tagPage[key]).toBe('string');
        expect((tagPage[key] as string).length).toBeGreaterThan(0);
      }
      for (const key of ['title', 'description', 'empty', 'listLabel']) {
        expect(tagPage[key] as string).toContain('{{tag}}');
      }
    }
  );

  it('gives Russian every plural form it needs', () => {
    const page = ruRuWebsite.website.blog.tagsPage;
    expect(page).toHaveProperty('postCount_one');
    expect(page).toHaveProperty('postCount_few');
    expect(page).toHaveProperty('postCount_many');
  });
});
