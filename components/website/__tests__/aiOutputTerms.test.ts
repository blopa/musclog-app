import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// The Terms' "AI Features and AI Output" section and the pointers to it are legal text: every
// language must carry every clause, in the same order, or a reader in that language agrees to less
// than the English page says.

const ROOT = join(__dirname, '..', '..', '..');
const LOCALES_DIR = join(ROOT, 'lang', 'locales');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const locales = readdirSync(LOCALES_DIR).filter((name) =>
  statSync(join(LOCALES_DIR, name)).isDirectory()
);

type Json = Record<string, unknown>;

function load(locale: string, file: string): Json {
  return JSON.parse(readFileSync(join(LOCALES_DIR, locale, file), 'utf8')) as Json;
}

function at(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === 'object' ? (node as Json)[part] : undefined,
      obj
    );
}

const english = load('en-us', 'website.json');
const englishItems = at(english, 'website.terms.sections.aiOutput.items') as string[];

describe('Terms: AI Features and AI Output', () => {
  it('has ten clauses in English', () => {
    expect(englishItems).toHaveLength(10);
  });

  it.each(locales)('%s carries every clause, the carve-out and the pointers', (locale) => {
    const website = load(locale, 'website.json');
    const section = at(website, 'website.terms.sections.aiOutput') as Json;

    expect(Object.keys(section).sort()).toEqual(['content1', 'content2', 'items', 'title']);
    expect(section.items).toHaveLength(englishItems.length);

    for (const path of [
      'website.terms.sections.aiOutput.title',
      'website.terms.sections.aiOutput.content1',
      'website.terms.sections.aiOutput.content2',
      'website.terms.sections.liability.content3',
      'website.terms.sections.disclaimer.content3',
      'website.privacy.sections.collecting.optionalAi.accuracy',
    ]) {
      expect(String(at(website, path) ?? '').trim()).not.toBe('');
    }

    for (const item of section.items as unknown[]) {
      expect(typeof item).toBe('string');
      expect(String(item).trim()).not.toBe('');
    }
  });

  it('the terms page renders the clauses, the carve-out and the warranty line', () => {
    const page = read('app/(website)/[locale]/terms.web.tsx');

    expect(page).toContain("'sections.aiOutput.items'");
    expect(page).toContain("'sections.aiOutput.content1'");
    expect(page).toContain("'sections.aiOutput.content2'");
    expect(page).toContain("'sections.liability.content3'");
    expect(page).toContain("'sections.disclaimer.content3'");
  });

  it('the privacy page renders the pointer to the terms', () => {
    expect(read('app/(website)/[locale]/privacy.web.tsx')).toContain(
      "'sections.collecting.optionalAi.accuracy'"
    );
  });
});
