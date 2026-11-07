import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { MUSCLE_LABEL_KEYS } from '@/components/progress/muscleLoadCopy';

const localesRoot = join(__dirname, '..', '..', '..', 'lang', 'locales');

type Json = { [key: string]: Json | string };

function load(locale: string): Json {
  return JSON.parse(readFileSync(join(localesRoot, locale, 'muscleLoad.json'), 'utf8')).muscleLoad;
}

function leaves(node: Json, prefix = ''): [string, string][] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value]] : leaves(value, `${prefix}${key}.`)
  );
}

/** The whole key `muscleLoad.<path>` resolved in a locale file, or undefined. */
function lookup(locale: string, key: string): string | undefined {
  const [, ...path] = key.split('.');
  let node: Json | string = load(locale);
  for (const part of path) {
    if (typeof node === 'string') {
      return undefined;
    }
    node = node[part];
  }

  return typeof node === 'string' ? node : undefined;
}

const LOCALES = ['en-us', 'es-es', 'nl-nl', 'pt-br', 'ru-ru'];

describe('muscle load copy', () => {
  it('ships a muscleLoad file in every locale', () => {
    for (const locale of LOCALES) {
      expect(readdirSync(join(localesRoot, locale))).toContain('muscleLoad.json');
    }
  });

  it('resolves every whole key the components name, in every locale', () => {
    const keys = Object.values(MUSCLE_LABEL_KEYS);
    for (const locale of LOCALES) {
      for (const key of keys) {
        expect(lookup(locale, key)).toEqual(expect.any(String));
      }
    }
  });

  it('never says a muscle is recovered or ready in en-us, bar the one footnote that says it is not', () => {
    const copy = leaves(load('en-us'));
    expect(copy.filter(([, text]) => /recover/i.test(text))).toEqual([]);

    const readyLines = copy.filter(([, text]) => /\bready\b/i.test(text)).map(([key]) => key);
    expect(readyLines).toEqual(['load.footnote']);
  });

  it('writes plurals as flat keys: a nested `_one` makes i18next return an object', () => {
    for (const locale of LOCALES) {
      const nested = leaves(load(locale)).filter(([key]) => /\._(one|few|many|other)$/.test(key));
      expect(nested).toEqual([]);
    }
  });

  it('keeps every plural form in every locale', () => {
    for (const locale of LOCALES) {
      for (const [key] of leaves(load(locale))) {
        const base = key.replace(/_(one|few|many|other)$/, '');
        if (key !== base) {
          expect(leaves(load(locale)).map(([k]) => k)).toEqual(
            expect.arrayContaining([`${base}_one`, `${base}_few`, `${base}_many`, `${base}_other`])
          );
        }
      }
    }
  });
});
