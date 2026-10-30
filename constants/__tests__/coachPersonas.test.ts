import type { TFunction } from 'i18next';

import {
  COACH_PERSONA_IDS,
  COACH_PRESET_PERSONA_IDS,
  COACH_PRESETS,
  coachDisplayName,
  CUSTOM_PERSONA_NAME_MAX,
  CUSTOM_PERSONA_VOICE_MAX,
  EMPTY_CUSTOM_PERSONA,
  isCustomPersonaComplete,
  normalizeCustomPersona,
  parseCoachPersonaId,
  parseCustomPersona,
  resolveCoachPersona,
  serializeCustomPersona,
} from '../coachPersonas';

const complete = { name: 'Coach Atlas', voice: 'Calm drill sergeant.', avatar: '' };

describe('parseCoachPersonaId', () => {
  it.each(COACH_PERSONA_IDS)('keeps the known id %s', (id) => {
    expect(parseCoachPersonaId(id)).toBe(id);
  });

  it.each([null, undefined, '', 'goku', 'LOGGY'])('falls back to loggy for %p', (raw) => {
    expect(parseCoachPersonaId(raw)).toBe('loggy');
  });
});

describe('COACH_PRESETS', () => {
  it.each(COACH_PRESET_PERSONA_IDS)('describes %s completely', (id) => {
    const preset = COACH_PRESETS[id];

    expect(preset.promptName.trim()).not.toBe('');
    expect(preset.voice.trim()).not.toBe('');
    expect(preset.nameKey).toBe(`coach.personas.${id}.name`);
    expect(preset.descriptionKey).toBe(`coach.personas.${id}.description`);
  });
});

describe('custom persona storage', () => {
  it('round-trips a persona', () => {
    const avatar = 'data:image/png;base64,AAAA';
    const stored = serializeCustomPersona({ ...complete, avatar });

    expect(parseCustomPersona(stored)).toEqual({ ...complete, avatar });
  });

  it('reads anything unreadable as an empty persona', () => {
    expect(parseCustomPersona(null)).toEqual(EMPTY_CUSTOM_PERSONA);
    expect(parseCustomPersona('not json')).toEqual(EMPTY_CUSTOM_PERSONA);
    expect(parseCustomPersona('42')).toEqual(EMPTY_CUSTOM_PERSONA);
  });

  it('trims and caps both texts again on read, since the row may come from a backup', () => {
    const parsed = parseCustomPersona(
      JSON.stringify({
        name: `  ${'n'.repeat(CUSTOM_PERSONA_NAME_MAX + 20)}  `,
        voice: 'v'.repeat(CUSTOM_PERSONA_VOICE_MAX + 20),
      })
    );

    expect(parsed.name).toHaveLength(CUSTOM_PERSONA_NAME_MAX);
    expect(parsed.voice).toHaveLength(CUSTOM_PERSONA_VOICE_MAX);
  });

  it('drops an avatar that is not an image data URI', () => {
    expect(
      normalizeCustomPersona({ ...complete, avatar: 'https://evil.example/a.png' }).avatar
    ).toBe('');
    expect(
      normalizeCustomPersona({ ...complete, avatar: 'data:text/html;base64,AAAA' }).avatar
    ).toBe('');
  });

  it('needs both a name and a voice to be complete', () => {
    expect(isCustomPersonaComplete(complete)).toBe(true);
    expect(isCustomPersonaComplete({ ...complete, name: '  ' })).toBe(false);
    expect(isCustomPersonaComplete({ ...complete, voice: '' })).toBe(false);
  });
});

describe('resolveCoachPersona', () => {
  it('resolves a preset to its own voice', () => {
    const resolved = resolveCoachPersona({
      id: 'dracula',
      custom: EMPTY_CUSTOM_PERSONA,
      provider: 'gemini',
    });

    expect(resolved).toMatchObject({
      id: 'dracula',
      promptName: 'Count Dracula',
      nameKey: 'coach.personas.dracula.name',
      avatar: '',
    });
  });

  it('resolves a complete custom persona', () => {
    expect(
      resolveCoachPersona({ id: 'custom', custom: complete, provider: 'openai' })
    ).toMatchObject({
      id: 'custom',
      promptName: 'Coach Atlas',
      nameKey: null,
      voice: 'Calm drill sergeant.',
    });
  });

  it('falls back to Loggy for a custom persona missing its name or voice', () => {
    for (const custom of [EMPTY_CUSTOM_PERSONA, { ...complete, voice: '' }]) {
      expect(resolveCoachPersona({ id: 'custom', custom, provider: 'gemini' })).toMatchObject({
        id: 'loggy',
      });
    }
  });

  it('always gives on-device AI Loggy, whatever was picked', () => {
    for (const id of COACH_PERSONA_IDS) {
      expect(resolveCoachPersona({ id, custom: complete, provider: 'on-device' })).toMatchObject({
        id: 'loggy',
        avatar: '',
      });
    }
  });

  it.each(['gateway', 'local', 'gemini', 'openai', null] as const)(
    'allows a persona on %p',
    (provider) => {
      expect(resolveCoachPersona({ id: 'cthulhu', custom: complete, provider }).id).toBe('cthulhu');
    }
  );
});

describe('coachDisplayName', () => {
  const t = ((key: string) => `translated:${key}`) as unknown as TFunction;

  it('translates a preset and shows a custom persona under its own name', () => {
    expect(
      coachDisplayName(
        resolveCoachPersona({ id: 'sherlock', custom: complete, provider: 'gemini' }),
        t
      )
    ).toBe('translated:coach.personas.sherlock.name');
    expect(
      coachDisplayName(
        resolveCoachPersona({ id: 'custom', custom: complete, provider: 'gemini' }),
        t
      )
    ).toBe('Coach Atlas');
  });
});
