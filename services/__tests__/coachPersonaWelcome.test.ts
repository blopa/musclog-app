import { ChatService } from '@/database/services/ChatService';
import { SettingsService } from '@/database/services/SettingsService';
import { settingsGetMock } from '@/database/services/__tests__/settingsGetMock';
import { applyPersonaWelcome } from '@/services/coachPersonaWelcome';

jest.mock('@/database/services/ChatService', () => ({
  ChatService: { rewriteUntouchedWelcomeMessages: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: jest.fn() },
}));

jest.mock('@/lang/lang', () => ({
  __esModule: true,
  AVAILABLE_LANGUAGES: ['en-US', 'pt-BR'],
  default: {
    t: (key: string, options?: { name?: string; lng?: string }) =>
      options?.name ? `${key}|${options.name}|${options.lng ?? 'current'}` : `t(${key})`,
  },
}));

const rewrite = ChatService.rewriteUntouchedWelcomeMessages as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('applyPersonaWelcome', () => {
  it('greets as the preset that is stored, in its translated name', async () => {
    SettingsService.get = settingsGetMock({ coachPersona: 'dracula' });

    await applyPersonaWelcome('gemini');

    const [texts] = rewrite.mock.calls[0];
    expect(texts.general).toBe('coach.welcomeMessage|t(coach.personas.dracula.name)|current');
  });

  it('greets as a custom persona that was JUST saved, because it reads the stored value', async () => {
    // The screen that triggers this holds an older render in which the custom persona was empty;
    // nothing from that render reaches the greeting, so it cannot fall back to Loggy.
    SettingsService.get = settingsGetMock({
      coachPersona: 'custom',
      coachCustomPersona: { name: 'Coach Atlas', voice: 'Calm.', avatar: '' },
    });

    await applyPersonaWelcome('openai');

    const [texts] = rewrite.mock.calls[0];
    expect(texts.nutrition).toBe('coach.welcomeMessageNutrition|Coach Atlas|current');
  });

  it('greets as Loggy on on-device AI, whatever is stored', async () => {
    SettingsService.get = settingsGetMock({ coachPersona: 'sherlock' });

    await applyPersonaWelcome('on-device');

    const [texts] = rewrite.mock.calls[0];
    expect(texts.exercise).toContain('coach.personas.loggy.name');
  });

  it('recognises the Loggy welcome of every bundled language as an untouched, unmarked one', async () => {
    SettingsService.get = settingsGetMock({ coachPersona: 'cthulhu' });

    await applyPersonaWelcome(null);

    const [, legacy] = rewrite.mock.calls[0] as [unknown, Set<string>];
    expect([...legacy]).toEqual(
      expect.arrayContaining([
        'coach.welcomeMessage|Loggy|en-US',
        'coach.welcomeMessageExercise|Loggy|pt-BR',
        'coach.welcomeMessageNutrition|Loggy|pt-BR',
      ])
    );
  });
});
