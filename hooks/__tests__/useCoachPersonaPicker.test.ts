/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';

import { SettingsService } from '@/database/services/SettingsService';
import { useCoachPersonaPicker } from '@/hooks/useCoachPersonaPicker';
import { applyPersonaWelcome } from '@/services/coachPersonaWelcome';

const calls: string[] = [];

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/context/CoachPersonaContext', () => ({
  useCoachPersona: () => ({ selectedId: 'loggy', custom: { name: '', voice: '', avatar: '' } }),
}));
jest.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ aiProvider: 'gemini' }) }));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { set: jest.fn(), updateCoachCustomPersona: jest.fn() },
}));
jest.mock('@/services/coachPersonaWelcome', () => ({ applyPersonaWelcome: jest.fn() }));
jest.mock('@/utils/file', () => ({ createThumbnail: jest.fn() }));
jest.mock('@/utils/galleryImagePicker', () => ({ pickAndCropImageFromGallery: jest.fn() }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

beforeEach(() => {
  calls.length = 0;
  jest.clearAllMocks();
  (SettingsService.set as jest.Mock).mockImplementation(async (_s, value) => {
    calls.push(`set:${value}`);
  });
  (SettingsService.updateCoachCustomPersona as jest.Mock).mockImplementation(async () => {
    calls.push('updateCustom');
  });
  (applyPersonaWelcome as jest.Mock).mockImplementation(async () => {
    calls.push('greet');
  });
});

describe('useCoachPersonaPicker', () => {
  it('saves the pick first, then greets as whatever is stored', async () => {
    const { result } = renderHook(() => useCoachPersonaPicker());

    await result.current.selectPersona('dracula');

    expect(calls).toEqual(['set:dracula', 'greet']);
    expect(applyPersonaWelcome).toHaveBeenCalledWith('gemini');
  });

  it('saving the custom persona selects it and greets once, after both writes', async () => {
    const { result } = renderHook(() => useCoachPersonaPicker());

    const saved = await result.current.saveCustomPersona({ name: 'Atlas', voice: 'Calm.' });

    expect(saved).toBe(true);
    expect(calls).toEqual(['updateCustom', 'set:custom', 'greet']);
  });

  it('reports a failed save without selecting or greeting', async () => {
    (SettingsService.updateCoachCustomPersona as jest.Mock).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useCoachPersonaPicker());

    expect(await result.current.saveCustomPersona({ name: 'Atlas', voice: 'Calm.' })).toBe(false);
    expect(applyPersonaWelcome).not.toHaveBeenCalled();
    expect(SettingsService.set).not.toHaveBeenCalled();
  });
});
