import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';

import { CycleTrackingModeSettings } from '@/components/cycle/CycleTrackingModeSettings';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { handleError } from '@/utils/handleError';

const mockNavigate = jest.fn();
const setTrackingMode = jest.fn();
const onClose = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useMenstrualCycle', () => ({ useMenstrualCycle: jest.fn() }));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ colors: { accent: { primary: '#000' } } }),
}));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/components/theme/Chip', () => ({
  Chip: ({
    label,
    selected,
    disabled,
    onPress,
  }: {
    label: string;
    selected: boolean;
    disabled: boolean;
    onPress: () => void;
  }) =>
    jest
      .requireActual('react')
      .createElement(
        'button',
        { role: 'radio', 'aria-checked': selected, disabled, onClick: onPress },
        label
      ),
}));

function configure(active: boolean, paused = false, symptoms = false) {
  jest.mocked(useMenstrualCycle).mockReturnValue({
    cycle: active ? { id: 'cycle' } : null,
    pausedCycle: paused ? { id: 'cycle' } : null,
    activeContext: { lifeStage: symptoms ? 'no_bleeding' : 'regular' },
    isLoading: false,
    setTrackingMode,
  } as unknown as ReturnType<typeof useMenstrualCycle>);
}

beforeEach(() => {
  jest.clearAllMocks();
  setTrackingMode.mockResolvedValue(undefined);
});

describe('cycle tracking choices in settings', () => {
  it.each([
    ['cycle.personalize.trackBleeding', false],
    ['cycle.personalize.trackSymptoms', true],
  ])('starts first-time setup for %s', (label, symptomOnly) => {
    configure(false);
    render(createElement(CycleTrackingModeSettings, { onClose }));
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    fireEvent.click(screen.getByRole('radio', { name: label }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/app/onboarding/cycle-setup',
      params: { symptomOnly: String(symptomOnly), nextRoute: encodeURIComponent('/app/settings') },
    });
    expect(setTrackingMode).not.toHaveBeenCalled();
  });

  it('resumes paused tracking in the chosen mode rather than opening replacement setup', async () => {
    configure(false, true);
    render(createElement(CycleTrackingModeSettings, { onClose }));
    fireEvent.click(screen.getByRole('radio', { name: 'cycle.personalize.trackSymptoms' }));
    await waitFor(() => expect(setTrackingMode).toHaveBeenCalledWith('symptoms'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows symptoms-only as selected and pauses when Skip is chosen', async () => {
    configure(true, false, true);
    render(createElement(CycleTrackingModeSettings, { onClose }));
    expect(
      screen
        .getByRole('radio', { name: 'cycle.personalize.trackSymptoms' })
        .getAttribute('aria-checked')
    ).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'cycle.personalize.skip' }));
    await waitFor(() => expect(setTrackingMode).toHaveBeenCalledWith('skip'));
  });

  it('reports save failures and keeps the saved choice selected', async () => {
    configure(true);
    setTrackingMode.mockRejectedValueOnce(new Error('write failed'));
    render(createElement(CycleTrackingModeSettings, { onClose }));
    fireEvent.click(screen.getByRole('radio', { name: 'cycle.personalize.skip' }));
    await waitFor(() => expect(handleError).toHaveBeenCalled());
    expect(
      screen
        .getByRole('radio', { name: 'cycle.personalize.trackBleeding' })
        .getAttribute('aria-checked')
    ).toBe('true');
  });
});
