import {
  bundledLocales,
  localeDirectory,
  localeSignatures,
  localeTag,
  resolveLocales,
  showsLocale,
} from '../locales';

describe('locale names', () => {
  it('converts between a locale folder and its tag', () => {
    expect(localeTag('ru-ru')).toBe('ru-RU');
    expect(localeTag('pt-br')).toBe('pt-BR');
    expect(localeDirectory('pt-BR')).toBe('pt-br');
  });
});

describe('bundledLocales', () => {
  it('lists every folder under lang/locales, English first', () => {
    expect(bundledLocales()).toEqual(['en-US', 'es-ES', 'nl-NL', 'pt-BR', 'ru-RU']);
  });
});

describe('resolveLocales', () => {
  it('defaults to every bundled locale, so a run is never English-only by accident', () => {
    expect(resolveLocales(undefined)).toEqual(bundledLocales());
    expect(resolveLocales('all')).toEqual(bundledLocales());
  });

  it('accepts a list, adds the stretched-English pass, and drops duplicates', () => {
    expect(resolveLocales('ru-RU, nl-NL')).toEqual(['ru-RU', 'nl-NL']);
    expect(resolveLocales('all,pseudo')).toEqual([...bundledLocales(), 'pseudo']);
    expect(resolveLocales('ru-RU,all')).toEqual(['ru-RU', 'en-US', 'es-ES', 'nl-NL', 'pt-BR']);
  });
});

describe('localeSignatures', () => {
  it('has none for English, so English always passes', () => {
    expect(localeSignatures('en-US')).toEqual([]);
    expect(showsLocale('anything at all', [])).toBe(true);
  });

  it('holds strings only the other locale has, never interpolated or multi-line ones', () => {
    const russian = localeSignatures('ru-RU');
    expect(russian.length).toBeGreaterThan(1000);
    expect(russian).toContain('Недельный обзор');
    expect(russian.some((text) => text.includes('{{'))).toBe(false);
    expect(russian.some((text) => text.includes('\n'))).toBe(false);
    expect(russian.every((text) => text.length >= 8)).toBe(true);
  });

  it('tells a page rendered in the locale from one rendered in English', () => {
    const dutch = localeSignatures('nl-NL');
    const english = localeSignatures('en-US');
    expect(english).toEqual([]);
    expect(showsLocale('Today / Weekly Review / Remaining', dutch)).toBe(false);
    expect(showsLocale(dutch[0], dutch)).toBe(true);
  });

  it('has nothing for a locale folder that does not exist', () => {
    expect(localeSignatures('xx-XX')).toEqual([]);
  });
});
