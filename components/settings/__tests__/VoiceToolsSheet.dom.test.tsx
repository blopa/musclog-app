import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { VoiceToolsSheet } from '@/components/settings/VoiceToolsSheet';
import { SettingsService } from '@/database/services/SettingsService';
import { SETTINGS } from '@/constants/settingDefinitions';
import { useVoiceToolLimit } from '@/hooks/useVoiceToolLimit';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/components/BottomPopUp', () => ({
  BottomPopUp: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? children : null,
}));
jest.mock('@/hooks/useVoiceToolLimit', () => ({ useVoiceToolLimit: jest.fn() }));
jest.mock('@/database/services/SettingsService', () => ({
  __esModule: true,
  SettingsService: { get: jest.fn(), set: jest.fn() },
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
const limit = useVoiceToolLimit as jest.Mock;

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
    limit.mockReturnValue(undefined);
  });

  it('lists every tool with the chosen ones first in pick order', async () => {
    const rows = await renderLoaded();

    expect(rows).toHaveLength(6);
    expect(rows[0].textContent).toContain('voiceInput.command.tool.searchFood');
    expect(rows[1].textContent).toContain('voiceInput.command.tool.copyMeal');
    expect(rows[2].textContent).toContain('voiceInput.command.tool.logWeight');
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

  it('marks chosen tools past the limit as not used', async () => {
    limit.mockReturnValue(1);
    const rows = await renderLoaded();

    expect(rows[0].textContent).not.toContain('voiceInput.tools.notUsed');
    expect(rows[1].textContent).toContain('voiceInput.tools.notUsed');
    expect(screen.getByText('voiceInput.tools.limitNote:1')).toBeTruthy();
  });
});
