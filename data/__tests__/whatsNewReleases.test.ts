import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { WHATS_NEW_MAX_PAGES } from '@/constants/whatsNew';
import { parseWhatsNewRelease } from '@/utils/whatsNew/schema';
import { compareVersions } from '@/utils/whatsNew/version';

import { WHATS_NEW_RELEASE_FILES, whatsNewReleases } from '../whatsNew/releases';

const root = join(__dirname, '../..');
test('registers every release file exactly once with valid content', () => {
  expect(Object.keys(WHATS_NEW_RELEASE_FILES).sort()).toEqual(readdirSync(join(root, 'data/whatsNew')).filter((name) => name.endsWith('.json')).sort());
  expect(new Set(whatsNewReleases.map((r) => r.version)).size).toBe(whatsNewReleases.length);
  for (const [name, raw] of Object.entries(WHATS_NEW_RELEASE_FILES)) {
    const result = parseWhatsNewRelease(raw, name);
    expect(result.issues).toEqual([]);
    expect(result.release?.version + '.json').toBe(name);
    expect(result.release!.pages.length).toBeLessThanOrEqual(WHATS_NEW_MAX_PAGES);
    const inspect = (value: unknown) => {
      if (!value || typeof value !== 'object') { return; }
      for (const [key, child] of Object.entries(value)) {
        if (key === 'supersededIn') { expect(compareVersions(child as string, raw.version)).toBe(1); }
        inspect(child);
      }
    };
    inspect(raw);
  }
});
test.each(['en-us', 'es-es', 'nl-nl', 'pt-br', 'ru-ru'])('resolves every JSON translation key in %s', (locale) => {
  const copy = JSON.parse(readFileSync(join(root, 'lang/locales', locale, 'whatsNew.json'), 'utf8'));
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') { return; }
    for (const [key, child] of Object.entries(value)) {
      if (key.endsWith('Key')) {
        const text = (child as string).split('.').reduce((obj, segment) => obj?.[segment], copy);
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
      } else { visit(child); }
    }
  };
  visit(WHATS_NEW_RELEASE_FILES);
});
