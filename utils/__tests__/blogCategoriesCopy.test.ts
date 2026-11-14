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

describe('blog categories copy', () => {
  it.each(Object.entries(locales))('%s has the category index and back-link strings', (_, copy) => {
    const blog = copy.website.blog as Record<string, unknown>;
    const page = blog.categoriesPage as Record<string, unknown>;

    expect(typeof blog.backToCategories).toBe('string');
    expect(typeof blog.browseCategories).toBe('string');
    expect(page).toBeDefined();
    for (const key of ['title', 'description', 'eyebrow', 'listLabel']) {
      expect(typeof page[key]).toBe('string');
      expect((page[key] as string).length).toBeGreaterThan(0);
    }
    expect(page.postCount_other).toContain('{{count}}');
  });

  it('gives Russian every plural form it needs', () => {
    const page = ruRuWebsite.website.blog.categoriesPage;
    expect(page).toHaveProperty('postCount_one');
    expect(page).toHaveProperty('postCount_few');
    expect(page).toHaveProperty('postCount_many');
  });
});
