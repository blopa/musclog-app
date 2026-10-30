import type { TFunction } from 'i18next';

import type { AiProviderKind } from '@/constants/ai';

/**
 * Who the AI coach is. One global choice (not per conversation context): Loggy, one of the
 * public-domain characters, or a persona the user writes themselves.
 *
 * A persona changes only the voice of text the user reads — the chat reply and the prose insights.
 * The functional rules (scope, safety, memory, summaries, structured output) live in the locked
 * core prompt and are never part of a persona. See `utils/coachPersonaPrompt.ts`.
 */
export const COACH_PRESET_PERSONA_IDS = ['loggy', 'dracula', 'cthulhu', 'sherlock'] as const;
export type CoachPresetPersonaId = (typeof COACH_PRESET_PERSONA_IDS)[number];

export const COACH_PERSONA_IDS = [...COACH_PRESET_PERSONA_IDS, 'custom'] as const;
export type CoachPersonaId = (typeof COACH_PERSONA_IDS)[number];

export const DEFAULT_COACH_PERSONA_ID: CoachPresetPersonaId = 'loggy';

export const CUSTOM_PERSONA_NAME_MAX = 40;
export const CUSTOM_PERSONA_VOICE_MAX = 600;

type CoachPreset = {
  /** The coach's name in prompts. Display names come from `nameKey`. */
  promptName: string;
  nameKey: `coach.personas.${CoachPresetPersonaId}.name`;
  descriptionKey: `coach.personas.${CoachPresetPersonaId}.description`;
  /** How the character talks. English, like every other prompt. */
  voice: string;
};

export const COACH_PRESETS: Record<CoachPresetPersonaId, CoachPreset> = {
  loggy: {
    promptName: 'Loggy',
    nameKey: 'coach.personas.loggy.name',
    descriptionKey: 'coach.personas.loggy.description',
    voice:
      'Friendly, professional, and human-like. Use colloquial language and emojis naturally. Motivating without being pushy.',
  },
  dracula: {
    promptName: 'Count Dracula',
    nameKey: 'coach.personas.dracula.name',
    descriptionKey: 'coach.personas.dracula.description',
    voice:
      'You are Count Dracula from Bram Stoker\'s novel, now an ancient, aristocratic strength coach. Speak with old-world courtesy and theatrical gravitas ("my dear friend", "the night is young"). Make playful references to castles, the night, centuries of discipline and avoiding sunlight, but never to drinking blood in a gory way. You are patient: you have trained for centuries and value consistency above all.',
  },
  cthulhu: {
    promptName: 'Cthulhu',
    nameKey: 'coach.personas.cthulhu.name',
    descriptionKey: 'coach.personas.cthulhu.description',
    voice:
      'You are Cthulhu, the Great Old One from H. P. Lovecraft\'s stories, who has awoken from sunken R\'lyeh and inexplicably become a devoted fitness coach. Speak in an ominous, cosmic, dramatically grand tone ("puny mortal", "the stars are right for leg day") with dry humor. Your menace is purely theatrical: you are genuinely supportive and want the mortal to thrive.',
  },
  sherlock: {
    promptName: 'Sherlock Holmes',
    nameKey: 'coach.personas.sherlock.name',
    descriptionKey: 'coach.personas.sherlock.description',
    voice:
      'You are Sherlock Holmes, the consulting detective from Arthur Conan Doyle\'s stories, now applying your methods to training and nutrition. Speak in a precise, observant, slightly Victorian manner. Read the user\'s logs like clues and explain your deductions ("You will observe that…", "Elementary."). Be brisk and clever, never condescending.',
  },
};

/** A persona the user wrote: their name for the coach, how it talks, and an optional avatar. */
export type CustomCoachPersona = {
  name: string;
  voice: string;
  /** A `data:image/...;base64,` URI, or `''` for the default avatar. */
  avatar: string;
};

export const EMPTY_CUSTOM_PERSONA: CustomCoachPersona = { name: '', voice: '', avatar: '' };

export function parseCoachPersonaId(raw: string | null | undefined): CoachPersonaId {
  return (COACH_PERSONA_IDS as readonly string[]).includes(raw ?? '')
    ? (raw as CoachPersonaId)
    : DEFAULT_COACH_PERSONA_ID;
}

const isAvatarDataUri = (value: unknown): value is string =>
  typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(value);

/** Normalizes a custom persona: trims, caps both texts and drops anything that is not an image URI. */
export function normalizeCustomPersona(value: Partial<CustomCoachPersona>): CustomCoachPersona {
  return {
    name: typeof value.name === 'string' ? value.name.trim().slice(0, CUSTOM_PERSONA_NAME_MAX) : '',
    voice:
      typeof value.voice === 'string' ? value.voice.trim().slice(0, CUSTOM_PERSONA_VOICE_MAX) : '',
    avatar: isAvatarDataUri(value.avatar) ? value.avatar : '',
  };
}

/** Reads a stored custom persona; anything unreadable is an empty one. */
export function parseCustomPersona(raw: string | null | undefined): CustomCoachPersona {
  if (!raw) {
    return { ...EMPTY_CUSTOM_PERSONA };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return normalizeCustomPersona(parsed as Partial<CustomCoachPersona>);
    }
  } catch {
    // Unreadable: fall through to the empty persona.
  }

  return { ...EMPTY_CUSTOM_PERSONA };
}

export function serializeCustomPersona(value: CustomCoachPersona): string {
  return JSON.stringify(normalizeCustomPersona(value));
}

/** A custom persona can only be used once it has both a name and a voice. */
export function isCustomPersonaComplete(value: CustomCoachPersona): boolean {
  return value.name.trim().length > 0 && value.voice.trim().length > 0;
}

/**
 * The persona that is actually in effect, after every fallback. One flat shape for presets and the
 * custom persona alike, so no consumer has to branch on which it is: the display name comes from
 * `coachDisplayName` and the avatar from `coachAvatarSource` (`components/coach/coachPersonaAvatars`).
 */
export type ResolvedCoachPersona = {
  id: CoachPersonaId;
  /** The coach's name in prompts. For a custom persona this is also its display name. */
  promptName: string;
  /** Translation key of a preset's display name; null for a custom persona, which names itself. */
  nameKey: CoachPreset['nameKey'] | null;
  voice: string;
  /** A custom persona's avatar data URI; '' for presets and for a custom persona without one. */
  avatar: string;
};

function presetPersona(id: CoachPresetPersonaId): ResolvedCoachPersona {
  const preset = COACH_PRESETS[id];

  return {
    id,
    promptName: preset.promptName,
    nameKey: preset.nameKey,
    voice: preset.voice,
    avatar: '',
  };
}

/** The name to show for a persona: translated for a preset, the user's own for a custom one. */
export function coachDisplayName(persona: ResolvedCoachPersona, t: TFunction): string {
  return persona.nameKey ? t(persona.nameKey) : persona.promptName;
}

/** Whether a provider may use a persona at all. On-device models have no room for one. */
export function providerSupportsPersona(provider: AiProviderKind | null | undefined): boolean {
  return provider !== 'on-device';
}

/**
 * The single place the persona fallbacks are decided: on-device AI always gets Loggy (its context
 * window is too small, and its prompt is the separate minimal one), and so does a custom persona
 * that is missing its name or voice.
 */
export function resolveCoachPersona({
  id,
  custom,
  provider,
}: {
  id: CoachPersonaId;
  custom: CustomCoachPersona;
  provider: AiProviderKind | null | undefined;
}): ResolvedCoachPersona {
  if (!providerSupportsPersona(provider)) {
    return presetPersona(DEFAULT_COACH_PERSONA_ID);
  }

  if (id === 'custom') {
    if (!isCustomPersonaComplete(custom)) {
      return presetPersona(DEFAULT_COACH_PERSONA_ID);
    }

    return {
      id: 'custom',
      promptName: custom.name.trim(),
      nameKey: null,
      voice: custom.voice.trim(),
      avatar: custom.avatar,
    };
  }

  return presetPersona(id);
}
