import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { useHasCamera } from '@/components/CameraView';
import { VoiceToolsSheet } from '@/components/settings/VoiceToolsSheet';
import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { useVoiceToolLimit } from '@/hooks/useVoiceToolLimit';
import { VOICE_TOOLS } from '@/utils/voiceCommand/tools';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/components/BottomPopUp', () => ({
  BottomPopUp: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? children : null,
}));
jest.mock('@/components/CameraView', () => ({ useHasCamera: jest.fn() }));
jest.mock('@/hooks/useVoiceToolLimit', () => ({ useVoiceToolLimit: jest.fn() }));
jest.mock('@/database/services/SettingsService', () => ({
  __esModule: true,
  SettingsService: { get: jest.fn(), set: jest.fn(), resetToDefaults: jest.fn() },
}));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.count !== undefined ? `${key}:${options.count}` : key,
    i18n: { language: 'en-US', resolvedLanguage: 'en-US' },
  }),
}));

const get = SettingsService.get as jest.Mock;
const set = SettingsService.set as jest.Mock;
const resetToDefaults = SettingsService.resetToDefaults as jest.Mock;
const limit = useVoiceToolLimit as jest.Mock;
const hasCamera = useHasCamera as jest.Mock;

const NOT_USED = 'voiceInput.tools.notUsed';
const USE_RECOMMENDED = 'voiceInput.tools.useRecommended';

function renderSheet() {
  return render(<VoiceToolsSheet visible onClose={jest.fn()} />);
}

/** Waits for the stored choice to load, so the rows are read in their final order. */
async function renderLoaded() {
  renderSheet();
  await waitFor(() => expect(screen.getAllByRole('checkbox')[0].textContent).toContain('search'));

  return screen.getAllByRole('checkbox');
}

describe('VoiceToolsSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    get.mockResolvedValue('search_food,copy_meal');
    set.mockResolvedValue(undefined);
    resetToDefaults.mockResolvedValue(undefined);
    limit.mockReturnValue({ max: undefined, nativeModel: false });
    hasCamera.mockReturnValue(true);
  });

  it('lists every tool with the chosen ones first in pick order', async () => {
    const rows = await renderLoaded();

    expect(rows).toHaveLength(10);
    expect(rows[0].textContent).toContain('voiceInput.command.tool.searchFood');
    expect(rows[1].textContent).toContain('voiceInput.command.tool.copyMeal');
    expect(rows[2].textContent).toContain('voiceInput.command.tool.logWeight');
  });

  it('hides the camera tool on a device without a camera', async () => {
    hasCamera.mockReturnValue(false);
    const rows = await renderLoaded();

    expect(rows).toHaveLength(9);
    expect(rows.some((row) => row.textContent?.includes(VOICE_TOOLS.open_camera.titleKey))).toBe(
      false
    );
  });

  it('does not let the last usable tool be removed on a device without a camera', async () => {
    hasCamera.mockReturnValue(false);
    get.mockResolvedValue('search_food,open_camera');
    const rows = await renderLoaded();

    fireEvent.click(rows[0]);

    expect(set).not.toHaveBeenCalled();
  });

  it('writes the serialized list when a tool is added', async () => {
    const rows = await renderLoaded();

    fireEvent.click(rows[2]);

    await waitFor(() => expect(set).toHaveBeenCalledTimes(1));
    expect(set).toHaveBeenCalledWith(
      SETTINGS.voiceCommandTools,
      'search_food,copy_meal,log_weight'
    );
  });

  it('writes the remaining list when a chosen tool is removed', async () => {
    const rows = await renderLoaded();

    fireEvent.click(rows[1]);

    await waitFor(() => expect(set).toHaveBeenCalledTimes(1));
    expect(set).toHaveBeenCalledWith(SETTINGS.voiceCommandTools, 'search_food');
  });

  it('does not write when the last chosen tool is removed', async () => {
    get.mockResolvedValue('search_food');
    const rows = await renderLoaded();

    fireEvent.click(rows[0]);

    expect(set).not.toHaveBeenCalled();
  });

  it('shows one divider before the first chosen tool past the limit, and the limit note', async () => {
    limit.mockReturnValue({ max: 1, nativeModel: false });
    const rows = await renderLoaded();

    expect(screen.getAllByText(NOT_USED)).toHaveLength(1);
    expect(rows[0].textContent).not.toContain(NOT_USED);
    expect(rows[1].textContent).not.toContain(NOT_USED);
    expect(screen.getByText('voiceInput.tools.limitNote:1')).toBeTruthy();
  });

  it('marks a tool the downloaded model is not offered', async () => {
    const original = VOICE_TOOLS.ask_coach.native.unsupported;
    VOICE_TOOLS.ask_coach.native.unsupported = true;

    try {
      limit.mockReturnValue({ max: undefined, nativeModel: true });
      const rows = await renderLoaded();
      const askCoach = rows.find((row) =>
        row.textContent?.includes(VOICE_TOOLS.ask_coach.titleKey)
      );

      expect(askCoach?.textContent).toContain(NOT_USED);
    } finally {
      VOICE_TOOLS.ask_coach.native.unsupported = original;
    }
  });

  it('offers the recommended order when the choice differs, and restores it', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByText(USE_RECOMMENDED));

    expect(resetToDefaults).toHaveBeenCalledWith([SETTINGS.voiceCommandTools]);
  });

  it('hides the recommended order button when the stored choice is the default', async () => {
    get.mockResolvedValue('');
    await renderLoaded();

    expect(screen.queryByText(USE_RECOMMENDED)).toBeNull();
  });
});
