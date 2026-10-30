import { COACH_PRESETS } from '@/constants/coachPersonas';
import { SettingsService } from '@/database/services/SettingsService';
import { settingsGetMock } from '@/database/services/__tests__/settingsGetMock';
import { getActiveCoachPersona } from '@/services/coachPersona';

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: jest.fn() },
}));

describe('getActiveCoachPersona', () => {
  it('uses the picked preset', async () => {
    SettingsService.get = settingsGetMock({ coachPersona: 'cthulhu' });

    expect(await getActiveCoachPersona('openai')).toMatchObject({
      id: 'cthulhu',
      promptName: COACH_PRESETS.cthulhu.promptName,
    });
  });

  it('uses the custom persona once it is complete', async () => {
    SettingsService.get = settingsGetMock({
      coachPersona: 'custom',
      coachCustomPersona: { name: 'Atlas', voice: 'Calm.', avatar: '' },
    });

    expect(await getActiveCoachPersona('gateway')).toMatchObject({
      id: 'custom',
      promptName: 'Atlas',
      nameKey: null,
    });
  });

  it('falls back to Loggy for a custom pick that is still empty', async () => {
    SettingsService.get = settingsGetMock({ coachPersona: 'custom' });

    expect(await getActiveCoachPersona('gemini')).toMatchObject({ id: 'loggy' });
  });

  it('gives on-device AI Loggy whatever was picked', async () => {
    SettingsService.get = settingsGetMock({ coachPersona: 'dracula' });

    expect(await getActiveCoachPersona('on-device')).toMatchObject({ id: 'loggy' });
  });

  it('falls back to Loggy when the settings cannot be read', async () => {
    SettingsService.get = jest.fn().mockRejectedValue(new Error('db not ready'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await getActiveCoachPersona('gemini')).toMatchObject({ id: 'loggy' });
    error.mockRestore();
  });
});
