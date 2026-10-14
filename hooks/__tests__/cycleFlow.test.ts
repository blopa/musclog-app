import { EditCycleSetupData } from '@/components/EditCycleSetupData';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';

import PersonalizedCycleScreen from '@/app/app/onboarding/personalized-cycle';
import { CycleDaySheet } from '@/components/cycle/CycleDaySheet';
import { CycleGoals } from '@/components/cycle/CycleGoals';
import { QuickLogRow } from '@/components/cycle/QuickLogRow';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { blankDayLog } from '@/utils/cycle/dayLog';
import { loadDayMood } from '@/utils/cycle/dayMood';

const mockNavigate = jest.fn();
const mockSave = jest.fn(async () => {});
const mockSnackbar = jest.fn();
const mockStartPeriod = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ cycleQuickLogRaw: '' }) }));
jest.mock('@/hooks/useMenstrualCycle', () => ({ useMenstrualCycle: jest.fn() }));
jest.mock('@/context/SnackbarContext', () => ({
  useSnackbar: () => ({ showSnackbar: mockSnackbar }),
}));
jest.mock('@/lang/lang', () => ({ DEFAULT_LANG: 'en-US' }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));
jest.mock('@/utils/onboardingService', () => ({
  setCurrentOnboardingStep: jest.fn(async () => {}),
}));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/utils/cycle/dayMood', () => ({
  loadDayMood: jest.fn(async () => ({ id: 'm', value: 3 })),
}));
jest.mock('@/components/cycle/ContextFields', () => ({
  ContextFields: ({ onLifeStageChange }: any) =>
    require('react').createElement(
      'button',
      { onClick: () => onLifeStageChange('regular') },
      'Switch context'
    ),
}));
jest.mock('@/components/modals/DatePickerInput', () => ({
  DatePickerInput: ({ label }: any) => require('react').createElement('div', {}, label),
}));
jest.mock('@/components/modals/DatePickerModal', () => ({ DatePickerModal: () => null }));
jest.mock('@/components/theme/NumericInput', () => ({
  NumericInput: ({ label }: any) => require('react').createElement('div', {}, label),
}));
jest.mock('@/components/MasterLayout', () => ({ MasterLayout: ({ children }: any) => children }));
jest.mock('@/components/BottomButtonWrapper', () => ({
  BottomButtonWrapper: ({ children }: any) => children,
}));
jest.mock('@/components/BottomPopUp', () => ({
  BottomPopUp: ({ children, footer, visible }: any) =>
    visible ? require('react').createElement('div', {}, children, footer) : null,
}));
jest.mock('@/components/QuickSetupProgressBar', () => ({ QuickSetupProgressBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));
jest.mock('@/components/theme/Button', () => ({
  Button: ({ label, onPress, disabled, loading }: any) =>
    require('react').createElement(
      'button',
      { onClick: onPress, disabled: disabled || loading },
      label
    ),
}));
jest.mock('@/components/theme/TextButton', () => ({
  TextButton: ({ label, onPress }: any) =>
    require('react').createElement('button', { onClick: onPress }, label),
}));
jest.mock('@/components/cards/MoodSelectorCard', () => ({
  MoodSelectorCard: ({ value }: any) => require('react').createElement('div', {}, `mood:${value}`),
}));

const day = new Date(2024, 0, 1).getTime();
const mockCycle = () => ({
  dayLogs: [],
  config: { fallbackCycleLength: 28, fallbackPeriodDuration: 5 },
  saveDayLog: mockSave,
  patchDayLog: async (date: number, update: any) => {
    const input = update(undefined);
    await mockSave(input);
    return input;
  },
  guidance: { hidePeriodActions: false },
  periods: [],
  startPeriod: mockStartPeriod,
  isActive: true,
});
beforeEach(() => {
  jest.clearAllMocks();
  (useMenstrualCycle as jest.Mock).mockReturnValue(mockCycle());
  (loadDayMood as jest.Mock).mockResolvedValue({ id: 'm', value: 3 });
});

it('offers symptom-only onboarding and routes it into setup rather than skipping tracking', async () => {
  render(createElement(PersonalizedCycleScreen));
  fireEvent.click(screen.getByText('cycle.personalize.trackSymptoms'));
  fireEvent.click(screen.getByRole('button', { name: 'onboarding.personalizedCycle.continue' }));
  await waitFor(() =>
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('cycle-setup?symptomOnly=true')
    )
  );
});
it('lets users independently select tracking goals', () => {
  const onChange = jest.fn();
  render(createElement(CycleGoals, { value: ['symptoms'], onChange }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'cycle.personalize.goals.mood' }));
  expect(onChange).toHaveBeenCalledWith(['symptoms', 'mood']);
});
it('keeps unexpected spotting available without prompting a period start in no-bleeding mode', async () => {
  (useMenstrualCycle as jest.Mock).mockReturnValue({
    ...mockCycle(),
    guidance: { hidePeriodActions: true },
  });
  render(createElement(QuickLogRow, { day }));
  fireEvent.click(screen.getByRole('radio', { name: 'cycle.calendar.bleeding.spotting' }));
  await waitFor(() =>
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ date: day, bleeding: 'spotting' })
    )
  );
  expect(mockSnackbar).not.toHaveBeenCalled();
  expect(mockStartPeriod).not.toHaveBeenCalled();
});
it('clears shared mood explicitly along with the cycle observations', async () => {
  (useMenstrualCycle as jest.Mock).mockReturnValue({
    ...mockCycle(),
    dayLogs: [{ ...blankDayLog(day), id: 'd', timezone: '+00:00', pain: 7 }],
  });
  render(createElement(CycleDaySheet, { visible: true, day, onClose: jest.fn() }));
  await screen.findByText('mood:3');
  fireEvent.click(screen.getByRole('button', { name: 'cycle.personalize.clearDayAndMood' }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith(blankDayLog(day), null));
});
it('does not display an unlogged mood as Okay and preserves archived observations when saving', async () => {
  (loadDayMood as jest.Mock).mockResolvedValue(null);
  const observations = { custom: { retired: 0 }, customLabels: { retired: 'Archived score' } };
  (useMenstrualCycle as jest.Mock).mockReturnValue({
    ...mockCycle(),
    dayLogs: [{ ...blankDayLog(day), id: 'd', timezone: '+00:00', observations }],
  });
  render(createElement(CycleDaySheet, { visible: true, day, onClose: jest.fn() }));
  await screen.findByText('mood:-1');
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'common.save' }) as HTMLButtonElement).disabled
    ).toBe(false)
  );
  fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
  await waitFor(() =>
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ observations }), undefined)
  );
});

it('does not ask for period dates or usual lengths in symptom-only setup and respects context changes', async () => {
  const onFormChange = jest.fn();
  render(
    createElement(EditCycleSetupData, { initialData: { lifeStage: 'no_bleeding' }, onFormChange })
  );
  expect(screen.queryByText('onboarding.cycleSetup.anchor.title')).toBeNull();
  expect(screen.queryByText('onboarding.cycleSetup.length.cycleLength')).toBeNull();
  expect(onFormChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ lifeStage: 'no_bleeding' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Switch context' }));
  await waitFor(() =>
    expect(onFormChange).toHaveBeenLastCalledWith(expect.objectContaining({ lifeStage: 'regular' }))
  );
  expect(screen.getByText('onboarding.cycleSetup.length.cycleLength')).toBeTruthy();
});
