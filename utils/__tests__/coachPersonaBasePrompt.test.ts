import fs from 'fs';
import path from 'path';

import { AiCustomPromptService } from '@/database/services/AiCustomPromptService';
import { SettingsService } from '@/database/services/SettingsService';
import { settingsGetMock } from '@/database/services/__tests__/settingsGetMock';
import { getActiveCoachPersona } from '@/services/coachPersona';

import { getBaseSystemPrompt, getChatReplyRules, getPersonaSystemPrompt } from '../prompts';

jest.mock('@/database/services/AiCustomPromptService', () => ({
  AiCustomPromptService: { getActivePrompts: jest.fn(), getMemoriesForPrompt: jest.fn() },
}));

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: jest.fn() },
}));

const mockPrompts = AiCustomPromptService.getActivePrompts as jest.Mock;
const mockMemories = AiCustomPromptService.getMemoriesForPrompt as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockPrompts.mockImplementation(async () => [{ content: 'USER-CUSTOM-PROMPT' }]);
  mockMemories.mockResolvedValue([{ content: 'USER-MEMORY', createdAt: Date.now() }]);
  SettingsService.get = settingsGetMock({ coachPersona: 'loggy' });
});

describe('getBaseSystemPrompt', () => {
  it('is name-neutral and has no persona section when no persona is passed', async () => {
    const prompt = await getBaseSystemPrompt('en-US', 'general', 'gemini');

    expect(prompt).not.toContain('Loggy');
    expect(prompt).not.toContain('Persona:');
    // The reply fields belong to the chat only: structured prompts share this base.
    expect(prompt).not.toContain('remember_me');
    expect(prompt).not.toContain('msg4User');
  });

  it('keeps the chat reply format, timestamps and memory rule in the chat-only block', () => {
    const rules = getChatReplyRules();

    expect(rules).toContain('msg4User');
    expect(rules).toContain('remember_me');
    expect(rules).toContain('timestamp');
    expect(rules).toContain('Never write such a timestamp yourself');
  });

  it('keeps the established tone for a prompt that carries no persona', async () => {
    const plain = await getBaseSystemPrompt('en-US', 'general', 'gemini');
    const persona = await getActiveCoachPersona('gemini');
    const voiced = await getBaseSystemPrompt('en-US', 'general', 'gemini', persona);

    expect(plain).toContain('1. TONE: Friendly, professional, and human-like. Use colloquial');
    // With a persona the voice is the persona's, so the core's tone line points at it instead.
    expect(voiced).toContain('1. TONE: Clear, practical');
    expect(voiced).toContain('The persona section below sets the exact voice');
  });

  it('places the persona after the locked rules and before custom prompts and memories', async () => {
    const persona = await getActiveCoachPersona('gemini');
    const prompt = await getBaseSystemPrompt('en-US', 'general', 'gemini', persona);

    const rules = prompt.indexOf('How to talk');
    const personaAt = prompt.indexOf('Persona: your name is Loggy');
    const custom = prompt.indexOf('USER-CUSTOM-PROMPT');
    const memory = prompt.indexOf('USER-MEMORY');

    expect(rules).toBeGreaterThan(-1);
    expect(personaAt).toBeGreaterThan(rules);
    expect(custom).toBeGreaterThan(personaAt);
    expect(memory).toBeGreaterThan(custom);
  });
});

describe('getPersonaSystemPrompt', () => {
  it('speaks as the coach stored in the settings', async () => {
    SettingsService.get = settingsGetMock({ coachPersona: 'sherlock' });

    const prompt = await getPersonaSystemPrompt('en-US', 'nutrition', 'gemini');

    expect(prompt).toContain('Persona: your name is Sherlock Holmes');
    expect(prompt).toContain('USER-MEMORY');
  });

  it('gives on-device AI Loggy and no injected memories, like the chat prompt', async () => {
    SettingsService.get = settingsGetMock({ coachPersona: 'dracula' });

    const prompt = await getPersonaSystemPrompt('en-US', 'nutrition', 'on-device');

    expect(prompt).toContain('Persona: your name is Loggy');
    expect(prompt).not.toContain('USER-MEMORY');
  });

  it('matches what getActiveCoachPersona resolves for the same provider', async () => {
    SettingsService.get = settingsGetMock({ coachPersona: 'cthulhu' });

    const persona = await getActiveCoachPersona('openai');

    expect(await getPersonaSystemPrompt('en-US', undefined, 'openai')).toBe(
      await getBaseSystemPrompt('en-US', undefined, 'openai', persona)
    );
  });
});

describe('which prompts carry a persona', () => {
  const source = fs.readFileSync(path.join(__dirname, '../prompts.ts'), 'utf8');
  const bodyOf = (name: string) => {
    const start = source.indexOf(`export const ${name} = async (`);
    const next = source.indexOf('\nexport const ', start + 1);

    return source.slice(start, next === -1 ? undefined : next);
  };

  it.each([
    'getChatMessagePromptContent',
    'getNutritionInsightsPrompt',
    'getMealCritiquePrompt',
    'getRecentWorkoutsInsightsPrompt',
    'getWorkoutInsightsPrompt',
    'getRecentWorkoutInsightsPrompt',
    'getWorkoutVolumeInsightsPrompt',
  ])('%s speaks in the persona`s voice', (name) => {
    expect(bodyOf(name)).toMatch(/getPersonaSystemPrompt\(|getActiveCoachPersona\(/);
  });

  it.each([
    'createWorkoutPlanPrompt',
    'getCalculateNextWorkoutVolumePrompt',
    'getParsePastWorkoutsPrompt',
    'getParsePastNutritionPrompt',
    'getRetrospectiveNutritionPrompt',
    'getGenerateMealPlanPrompt',
  ])('%s stays neutral: its output is structured data', (name) => {
    expect(bodyOf(name)).not.toMatch(/persona/i);
  });
});
