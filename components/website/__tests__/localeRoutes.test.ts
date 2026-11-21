import { readdirSync } from 'fs';
import { join } from 'path';

import {
  DEFAULT_LOCALE_PREFIX,
  hreflangAlternatePaths,
  legacyForwardPath,
  localeForLanguage,
  localePrefixesFor,
  localeScopeOf,
  localizedPath,
  parsePublicPath,
  stripLocalePrefix,
  WEBSITE_LOCALES,
} from '../localeRoutes';
import routes from '../websiteRoutes.json';
import { LANGUAGE_STORAGE_KEY } from '../localeRoutes';
import { LANDING_LANGUAGE_STORAGE_KEY } from '@/lang/lang';

describe('website locales', () => {
  it('shares the language storage key with the generated landing script', () => {
    expect(LANGUAGE_STORAGE_KEY).toBe(LANDING_LANGUAGE_STORAGE_KEY);
  });

  it('has one URL prefix per bundled language, English first', () => {
    const directories = readdirSync(join(__dirname, '../../../lang/locales'), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(WEBSITE_LOCALES.map((locale) => locale.language.toLowerCase()).sort()).toEqual(
      directories
    );
    expect(WEBSITE_LOCALES.map((locale) => locale.prefix)).toEqual([
      'en',
      'es',
      'nl',
      'pt-br',
      'ru',
      'de',
      'fr',
      'it',
      'pl',
      'tr',
    ]);
    expect(DEFAULT_LOCALE_PREFIX).toBe('en');
  });

  it('tells search engines Portuguese is the Brazilian one and the rest are language-wide', () => {
    expect(WEBSITE_LOCALES.map((locale) => locale.hreflang)).toEqual([
      'en',
      'es',
      'nl',
      'pt-BR',
      'ru',
      'de',
      'fr',
      'it',
      'pl',
      'tr',
    ]);
  });

  it('finds the locale of an i18n language, English when unknown', () => {
    expect(localeForLanguage('pt-br').prefix).toBe('pt-br');
    expect(localeForLanguage('ru-RU').prefix).toBe('ru');
    expect(localeForLanguage('es').prefix).toBe('es');
    expect(localeForLanguage('de-DE').prefix).toBe('de');
    expect(localeForLanguage('ja-JP').prefix).toBe('en');
    expect(localeForLanguage(undefined).prefix).toBe('en');
  });
});

describe('localizedPath', () => {
  it('puts every page under its language, English included', () => {
    expect(localizedPath('/tools/protein-calculator', 'en')).toBe('/en/tools/protein-calculator');
    expect(localizedPath('/tools/protein-calculator', 'pt-br')).toBe(
      '/pt-br/tools/protein-calculator'
    );
    expect(localizedPath('/', 'es')).toBe('/es');
    expect(localizedPath('/programs/push-pull-legs', 'ru')).toBe('/ru/programs/push-pull-legs');
  });

  it('keeps the query and hash and drops a trailing slash', () => {
    expect(localizedPath('/exercises?q=squat', 'nl')).toBe('/nl/exercises?q=squat');
    expect(localizedPath('/faq#privacy', 'es')).toBe('/es/faq#privacy');
    expect(localizedPath('/faq/', 'es')).toBe('/es/faq');
  });

  it('links the blog in English whatever the language', () => {
    expect(localizedPath('/blog', 'es')).toBe('/en/blog');
    expect(localizedPath('/blog/2026/08/post', 'ru')).toBe('/en/blog/2026/08/post');
    expect(localizedPath('/blog/tag/expo/page/2', 'nl')).toBe('/en/blog/tag/expo/page/2');
  });

  it('never prefixes /open, /test or anything that is not a website page', () => {
    for (const path of [
      '/open',
      '/open#workout=abc',
      '/test',
      '/app',
      '/app/nutrition/food',
      '/images/logo.png',
      '/downloads/workout-log.pdf',
      '/llms.txt',
      '/.well-known/assetlinks.json',
    ]) {
      expect(localizedPath(path, 'es')).toBe(path);
    }
  });
});

describe('locale scope', () => {
  it('follows the registry, the nearest registered ancestor deciding', () => {
    expect(localeScopeOf('/tools/protein-calculator')).toBe('all');
    expect(localeScopeOf('/programs/phul')).toBe('all');
    expect(localeScopeOf('/')).toBe('all');
    expect(localeScopeOf('/blog')).toBe('en');
    expect(localeScopeOf('/blog/category/retro/page/2')).toBe('en');
    expect(localeScopeOf('/open')).toBe('none');
    expect(localeScopeOf('/app')).toBeNull();
  });

  it('keeps English-only and unprefixed registrations to the pages that are meant to be', () => {
    const englishOnly = Object.entries(routes)
      .filter(([, route]) => 'locales' in route && route.locales === 'en')
      .map(([key]) => key);
    const unprefixed = Object.entries(routes)
      .filter(([, route]) => 'locales' in route && route.locales === 'none')
      .map(([key]) => key);
    expect(englishOnly.sort()).toEqual(['blog', 'blogCategories', 'blogTags']);
    expect(unprefixed.sort()).toEqual(['open', 'test']);
  });

  it('publishes a translated route in every locale', () => {
    expect(localePrefixesFor('/tools/rpe-chart')).toEqual([
      'en',
      'es',
      'nl',
      'pt-br',
      'ru',
      'de',
      'fr',
      'it',
      'pl',
      'tr',
    ]);
    expect(localePrefixesFor('/blog')).toEqual(['en']);
    expect(localePrefixesFor('/open')).toEqual([]);
  });
});

describe('hreflangAlternatePaths', () => {
  it('lists every locale plus x-default pointing at English', () => {
    expect(hreflangAlternatePaths('/tools/rpe-chart')).toEqual([
      ['en', '/en/tools/rpe-chart'],
      ['es', '/es/tools/rpe-chart'],
      ['nl', '/nl/tools/rpe-chart'],
      ['pt-BR', '/pt-br/tools/rpe-chart'],
      ['ru', '/ru/tools/rpe-chart'],
      ['de', '/de/tools/rpe-chart'],
      ['fr', '/fr/tools/rpe-chart'],
      ['it', '/it/tools/rpe-chart'],
      ['pl', '/pl/tools/rpe-chart'],
      ['tr', '/tr/tools/rpe-chart'],
      ['x-default', '/en/tools/rpe-chart'],
    ]);
  });

  it('is the same set whichever language the page is in', () => {
    // The set is a function of the logical path only, so every page of a cluster lists the others.
    for (const route of Object.values(routes).filter((route) => !('locales' in route))) {
      const sets = WEBSITE_LOCALES.map((locale) =>
        JSON.stringify(
          hreflangAlternatePaths(stripLocalePrefix(localizedPath(route.path, locale.prefix)))
        )
      );
      expect(new Set(sets).size).toBe(1);
    }
  });

  it('is empty for English-only and unprefixed pages', () => {
    expect(hreflangAlternatePaths('/blog/2026/08/post')).toEqual([]);
    expect(hreflangAlternatePaths('/blog')).toEqual([]);
    expect(hreflangAlternatePaths('/open')).toEqual([]);
  });
});

describe('old addresses', () => {
  it('forwards an unprefixed page to English, keeping query and hash', () => {
    expect(legacyForwardPath('/tools/protein-calculator')).toBe('/en/tools/protein-calculator');
    expect(legacyForwardPath('/')).toBe('/en');
    expect(legacyForwardPath('/exercises', '?q=squat', '#top')).toBe('/en/exercises?q=squat#top');
    expect(legacyForwardPath('/blog/2026/08/post')).toBe('/en/blog/2026/08/post');
  });

  it('leaves prefixed addresses, /open and non-pages alone', () => {
    expect(legacyForwardPath('/es/tools/protein-calculator')).toBeNull();
    expect(legacyForwardPath('/en')).toBeNull();
    expect(legacyForwardPath('/open')).toBeNull();
    expect(legacyForwardPath('/app/nutrition/food')).toBeNull();
  });

  it('reads a public address back into its language and logical path', () => {
    expect(parsePublicPath('/pt-br/tools/rpe-chart')).toMatchObject({
      path: '/tools/rpe-chart',
      locale: { prefix: 'pt-br' },
    });
    expect(parsePublicPath('/es')).toMatchObject({ path: '/', locale: { prefix: 'es' } });
    expect(parsePublicPath('/tools/rpe-chart').locale).toBeNull();
    expect(stripLocalePrefix('/ru/faq')).toBe('/faq');
  });
});

describe('pages under app/(website)/[locale]', () => {
  const { readdirSync, readFileSync, statSync } = require('fs') as typeof import('fs');
  const root = join(__dirname, '../../../app/(website)/[locale]');

  function webPages(directory: string): string[] {
    return readdirSync(directory).flatMap((name) => {
      const full = join(directory, name);
      if (statSync(full).isDirectory()) {
        return webPages(full);
      }

      return name.endsWith('.web.tsx') ? [full] : [];
    });
  }

  it('has no layout, so the language is part of each page route', () => {
    expect(readdirSync(root).filter((name) => name.startsWith('_layout'))).toEqual([]);
  });

  it('exports its languages from every page, with metadata read from the route params', () => {
    const pages = webPages(root);
    expect(pages.length).toBeGreaterThan(20);
    for (const page of pages) {
      const source = readFileSync(page, 'utf8');
      expect(source).toMatch(/export (const|async function) generateStaticParams/);
      expect(source).toMatch(/export const generateMetadata/);
    }
  });
});
