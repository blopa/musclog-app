import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { WHATS_NEW_MAX_PAGES } from '@/constants/whatsNew';
import { WHATS_NEW_ACTION_CATALOG } from '@/utils/whatsNew/catalog';
import { parseWhatsNewRelease } from '@/utils/whatsNew/schema';
import { compareVersions } from '@/utils/whatsNew/version';

import { WHATS_NEW_RELEASE_FILES, whatsNewReleases } from '../whatsNew/releases';

const root = join(__dirname, '../..');
test('registers every release file exactly once with valid content', () => {
  expect(Object.keys(WHATS_NEW_RELEASE_FILES).sort()).toEqual(
    readdirSync(join(root, 'data/whatsNew'))
      .filter((name) => name.endsWith('.json'))
      .sort()
  );
  expect(new Set(whatsNewReleases.map((r) => r.version)).size).toBe(whatsNewReleases.length);
  for (const [name, raw] of Object.entries(WHATS_NEW_RELEASE_FILES)) {
    const result = parseWhatsNewRelease(raw, name);
    expect(result.issues).toEqual([]);
    expect(result.release?.version + '.json').toBe(name);
    expect(result.release!.pages.length).toBeLessThanOrEqual(WHATS_NEW_MAX_PAGES);
    const inspect = (value: unknown) => {
      if (!value || typeof value !== 'object') {
        return;
      }
      for (const [key, child] of Object.entries(value)) {
        if (key === 'supersededIn') {
          expect(compareVersions(child as string, raw.version)).toBe(1);
        }
        inspect(child);
      }
    };
    inspect(raw);
  }
});
test.each(['en-us', 'es-es', 'nl-nl', 'pt-br', 'ru-ru'])(
  'resolves every JSON translation key in %s',
  (locale) => {
    const copy = JSON.parse(
      readFileSync(join(root, 'lang/locales', locale, 'whatsNew.json'), 'utf8')
    );
    const visit = (value: unknown) => {
      if (!value || typeof value !== 'object') {
        return;
      }
      for (const [key, child] of Object.entries(value)) {
        if (key.endsWith('Key')) {
          const text = (child as string).split('.').reduce((obj, segment) => obj?.[segment], copy);
          expect(typeof text).toBe('string');
          expect(text.length).toBeGreaterThan(0);
        } else {
          visit(child);
        }
      }
    };
    visit(WHATS_NEW_RELEASE_FILES);
  }
);

describe('the AI setup page of 2.15.2', () => {
  const release = whatsNewReleases.find((candidate) => candidate.version === '2.15.2');
  const page = release?.pages.find((candidate) => candidate.id === 'aiSetup');

  it('is part of the release and leads with a headline the intro can list', () => {
    expect(page).toBeDefined();
    expect(page?.blocks[0]).toMatchObject({
      type: 'info',
      titleKey: 'whatsNew.releases.v2_15_2.aiSetup.title',
    });
  });

  it('ends with an action that opens the AI profile update, not a modal', () => {
    const action = page?.blocks.find((block) => block.type === 'action');

    expect(action).toMatchObject({ type: 'action', action: 'openProfileAiSetup' });
    expect(WHATS_NEW_ACTION_CATALOG.openProfileAiSetup).toEqual({
      kind: 'route',
      route: '/app/onboarding/ai-setup?mode=profile',
    });
  });
});

describe('the coach persona page of 2.15.2', () => {
  const release = whatsNewReleases.find((candidate) => candidate.version === '2.15.2');
  const page = release?.pages.find((candidate) => candidate.id === 'coachPersona');

  it('is part of the release, leads with a headline the intro can list and has no gate', () => {
    expect(page).toBeDefined();
    expect(page?.blocks[0]).toMatchObject({
      type: 'info',
      titleKey: 'whatsNew.releases.v2_15_2.coachPersona.title',
    });
    expect(page?.requires).toBeUndefined();
  });

  it('explains the presets, the custom coach and that only the voice changes', () => {
    expect(page?.blocks.map((block) => block.id)).toEqual([
      'coachPersona',
      'coachCustom',
      'coachVoiceOnly',
    ]);
  });
});
