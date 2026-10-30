import fs from 'fs';
import path from 'path';

import { AiCustomPromptService } from '@/database/services/AiCustomPromptService';
import { SettingsService } from '@/database/services/SettingsService';
import { settingsGetMock } from '@/database/services/__tests__/settingsGetMock';
import { getActiveCoachPersona } from '@/services/coachPersona';

import { getBaseSystemPrompt, getPersonaSystemPrompt } from '../prompts';

jest.mock('@/database/services/AiCustomPromptService', () => ({
  AiCustomPromptService: { getActivePrompts: jest.fn() },
}));

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: jest.fn() },
}));

const mockPrompts = AiCustomPromptService.getActivePrompts as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockPrompts.mockImplementation(async (_context: unknown, type: string) =>
    type === 'system' ? [{ content: 'USER-CUSTOM-PROMPT' }] : [{ content: 'USER-MEMORY' }]
  );
  SettingsService.get = settingsGetMock({ coachPersona: 'loggy' });
});

describe('getBaseSystemPrompt', () => {
  it('is name-neutral and has no persona section when no persona is passed', async () => {
    const prompt = await getBaseSystemPrompt('en-US', 'general', 'gemini');

    expect(prompt).not.toContain('Loggy');
    expect(prompt).not.toContain('Persona:');
    expect(prompt).toContain('remember_me');
  });

  it('places the persona after the locked rules and before custom prompts and memories', async () => {
    const persona = await getActiveCoachPersona('gemini');
    const prompt = await getBaseSystemPrompt('en-US', 'general', 'gemini', persona);

    const rules = prompt.indexOf('Conversation Guidelines');
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
