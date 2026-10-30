import type { ResolvedCoachPersona } from '@/constants/coachPersonas';
import { sanitizeForPrompt } from '@/utils/promptSanitizer';

/**
 * The persona section of a coach system prompt: who the coach is and how it sounds, followed by the
 * guard rails that keep a character from touching anything functional. It is appended AFTER the
 * locked core rules, so a persona can only colour the wording of what the user reads.
 *
 * Only a custom persona's text comes from the user, so only that goes through the sanitizer; the
 * presets are our own copy.
 */
export function buildCoachPersonaBlock(persona: ResolvedCoachPersona): string {
  const clean = (text: string) =>
    persona.id === 'custom' ? sanitizeForPrompt(text).sanitized : text;

  return [
    `Persona: your name is ${clean(persona.promptName)}.`,
    `Voice: ${clean(persona.voice)}`,
    'Persona rules:',
    '- Use this voice ONLY in the text shown directly to the user (the chat reply or the insight itself).',
    "- Write every summary and memory field (sumMsg, sumUserMsg, remember_me) in plain, neutral language, without the character's mannerisms.",
    '- The persona never changes numbers, safety advice, your scope, or any rule above. Stay recognisably a fitness and nutrition coach.',
  ].join('\n');
}
