import fs from 'fs';
import path from 'path';

import {
  findFoundationFoodExternalIds,
  getEnglishFoundationFoodText,
  localizeFoundationFood,
} from '@/data/foundationFoodCatalogue';
import commonFoundationFoods from '@/data/common_foundation_foods.json';
import usdaFoundationFoods from '@/data/usda_foundation_foods.json';
import { AVAILABLE_LANGUAGES, FOUNDATION_FOOD_COPIES_BY_LOCALE } from '@/lang/lang';

// Entry used throughout: lettuce mix, same row in both seed files and every copy file.
const LETTUCE_ID = '1703909';
const LETTUCE_EN_NAME = 'Spring Mix a Medley of Baby Lettuces & Greens';
const LETTUCE_EN_DESCRIPTION = 'Lettuce, leaf, green, raw';
const LETTUCE_DE_NAME = 'Frühlingsmischung aus Babysalat und Gemüse';
const LETTUCE_DE_DESCRIPTION = 'Salat, Blatt, grün, roh';

const OVERRIDES_PATH = path.join(
  __dirname,
  '..',
  '..',
  'scripts',
  'foundation-food-translation-overrides.json'
);

const expectedIds = (() => {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const row of [...usdaFoundationFoods, ...commonFoundationFoods]) {
    if (!seen.has(row.external_id)) {
      seen.add(row.external_id);
      ids.push(row.external_id);
    }
  }
  return ids;
})();

const capitalizeFirst = (value: string, locale: string) =>
  value.charAt(0).toLocaleUpperCase(locale) + value.slice(1);

describe('foundation food copies', () => {
  const locales = Object.keys(
    FOUNDATION_FOOD_COPIES_BY_LOCALE
  ) as (keyof typeof FOUNDATION_FOOD_COPIES_BY_LOCALE)[];

  it('has one copy file per non-English language, with exactly the seeded external ids in seed order', () => {
    expect(locales).toHaveLength(9);
    expect(expectedIds).toHaveLength(527);

    for (const locale of locales) {
      const copies = FOUNDATION_FOOD_COPIES_BY_LOCALE[locale];
      expect({ locale, ids: copies.map((copy) => copy.externalId) }).toEqual({
        locale,
        ids: expectedIds,
      });
    }
  });

  it('gives every copy a non-empty name and description', () => {
    for (const locale of locales) {
      for (const copy of FOUNDATION_FOOD_COPIES_BY_LOCALE[locale]) {
        expect(typeof copy.name).toBe('string');
        expect(copy.name.trim().length).toBeGreaterThan(0);
        expect(typeof copy.description).toBe('string');
        expect(copy.description.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('has a copy for every available language except English', () => {
    const expected = AVAILABLE_LANGUAGES.filter((language) => language !== 'en-US').sort();

    expect([...locales].sort()).toEqual(expected);
  });

  it('applies every override in scripts/foundation-food-translation-overrides.json', () => {
    if (!fs.existsSync(OVERRIDES_PATH)) {
      // The overrides file is optional until a translation fix is needed.
      return;
    }

    // Shape: { "<language>": { "<externalId>": { "name"?: string, "description"?: string } } }, where
    // <language> is the bare language code ("de") of a copy locale ("de-DE").
    const overrides = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8')) as Record<
      string,
      Record<string, { name?: string; description?: string }>
    >;

    for (const [language, byId] of Object.entries(overrides)) {
      const key = capitalizeFirst(language.toLocaleLowerCase(), language);
      const locale = locales.find(
        (candidate) => capitalizeFirst(candidate.split('-')[0], candidate) === key
      );
      expect({ language, found: locale !== undefined }).toEqual({ language, found: true });
      if (!locale) {
        continue;
      }

      for (const [externalId, fields] of Object.entries(byId)) {
        const copy = FOUNDATION_FOOD_COPIES_BY_LOCALE[locale].find(
          (candidate) => candidate.externalId === externalId
        );
        expect({ locale, externalId, found: copy !== undefined }).toEqual({
          locale,
          externalId,
          found: true,
        });
        if (fields.name !== undefined) {
          expect({ locale, externalId, name: copy?.name }).toEqual({
            locale,
            externalId,
            name: fields.name,
          });
        }
        if (fields.description !== undefined) {
          expect({ locale, externalId, description: copy?.description }).toEqual({
            locale,
            externalId,
            description: fields.description,
          });
        }
      }
    }
  });
});

describe('localizeFoundationFood', () => {
  const seed = {
    externalId: LETTUCE_ID,
    name: LETTUCE_EN_NAME,
    description: LETTUCE_EN_DESCRIPTION,
    kcal: '20',
  };

  it('returns the de-DE name and description and keeps the other fields', () => {
    const localized = localizeFoundationFood(seed, 'de-DE');

    expect(localized).toEqual({
      ...seed,
      name: LETTUCE_DE_NAME,
      description: LETTUCE_DE_DESCRIPTION,
    });
  });

  it('returns the input object unchanged for en-US, an unknown locale and an unknown externalId', () => {
    expect(localizeFoundationFood(seed, 'en-US')).toBe(seed);
    expect(localizeFoundationFood(seed, 'xx-XX')).toBe(seed);
    const unknown = { ...seed, externalId: 'not-a-food' };
    expect(localizeFoundationFood(unknown, 'de-DE')).toBe(unknown);
  });
});

describe('getEnglishFoundationFoodText', () => {
  const base = {
    name: LETTUCE_DE_NAME,
    description: LETTUCE_DE_DESCRIPTION,
    externalId: LETTUCE_ID,
    source: 'foundation',
    createdAt: 1000,
    updatedAt: 1000,
  };

  it('returns English for an untouched food whatever the stored words say', () => {
    expect(getEnglishFoundationFoodText(base)).toEqual({
      name: LETTUCE_EN_NAME,
      description: LETTUCE_EN_DESCRIPTION,
    });
    expect(getEnglishFoundationFoodText({ ...base, name: 'Something else' }).name).toBe(
      LETTUCE_EN_NAME
    );
  });

  it('returns English for an edited food whose name is a bundled translation', () => {
    const edited = { ...base, updatedAt: 2000, description: 'Own note' };

    expect(getEnglishFoundationFoodText(edited)).toEqual({
      name: LETTUCE_EN_NAME,
      description: 'Own note',
    });
  });

  it('keeps a name the person wrote while an unchanged translated description becomes English', () => {
    const edited = { ...base, updatedAt: 2000, name: 'Mein Salat' };

    expect(getEnglishFoundationFoodText(edited)).toEqual({
      name: 'Mein Salat',
      description: LETTUCE_EN_DESCRIPTION,
    });
  });

  it('returns the stored words for a non-foundation source or an unknown externalId', () => {
    const stored = { name: 'Mein Salat', description: 'x' };

    expect(getEnglishFoundationFoodText({ ...base, source: 'openfood' })).toEqual({
      name: base.name,
      description: base.description,
    });
    expect(getEnglishFoundationFoodText({ ...base, externalId: 'nope' })).toEqual({
      name: base.name,
      description: base.description,
    });
    expect(getEnglishFoundationFoodText({ ...base, ...stored, externalId: 'nope' })).toEqual(
      stored
    );
  });
});

describe('findFoundationFoodExternalIds', () => {
  it('finds a food by its English name while the locale is de-DE', () => {
    expect(findFoundationFoodExternalIds('Spring Mix', { locale: 'de-DE' })).toContain(LETTUCE_ID);
  });

  it('finds a Russian name typed in lower case with the ru-RU locale', () => {
    const ru = FOUNDATION_FOOD_COPIES_BY_LOCALE['ru-RU'].find(
      (copy) => copy.externalId === LETTUCE_ID
    );
    expect(ru).toBeDefined();

    expect(findFoundationFoodExternalIds(ru!.name.toLowerCase(), { locale: 'ru-RU' })).toContain(
      LETTUCE_ID
    );
  });

  it('ignores accents in the search term', () => {
    expect(findFoundationFoodExternalIds('Fruhlingsmischung', { locale: 'de-DE' })).toContain(
      LETTUCE_ID
    );
  });

  it('searches descriptions only when includeDescription is true', () => {
    expect(findFoundationFoodExternalIds('Lettuce, leaf', { locale: 'de-DE' })).not.toContain(
      LETTUCE_ID
    );
    expect(
      findFoundationFoodExternalIds('Lettuce, leaf', { locale: 'de-DE', includeDescription: true })
    ).toContain(LETTUCE_ID);
  });

  it('returns nothing for an empty or whitespace term', () => {
    expect(findFoundationFoodExternalIds('')).toEqual([]);
    expect(findFoundationFoodExternalIds('   ')).toEqual([]);
  });
});
