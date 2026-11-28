import { act, fireEvent, render, screen } from '@testing-library/react';

import PersonalizedBodyStatsScreen from '@/app/app/onboarding/personalized-body-stats';
import QuickBodyStatsScreen from '@/app/app/onboarding/quick-body-stats';
import { ReviewFieldEditor } from '@/components/aiOnboarding/ReviewFieldEditor';
import { localDayStartMs } from '@/utils/calendarDate';

// The birthday is the person's own answer and it is optional. A calendar confirmed untouched
// answers nothing, and a birthday under 16 is told about but never blocks Continue.

const mockInitializeUser = jest.fn(async (_data: { dateOfBirth: number | null }) => undefined);
const mockCommitProfile = jest.fn(async (_answers: Record<string, unknown>) => undefined);
const mockReadBodyStatsDraft = jest.fn(async (): Promise<{ birthDate?: string }> => ({}));

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/hooks/useSettings', () => ({ useSettings: () => ({}) }));
jest.mock('@/hooks/useDateFnsLocale', () => ({
  useDateFnsLocale: () => require('date-fns/locale').enUS,
}));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US', resolvedLanguage: 'en-US' },
  }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/MasterLayout', () => ({
  MasterLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/components/BottomButtonWrapper', () => ({
  BottomButtonWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/components/QuickSetupProgressBar', () => ({ QuickSetupProgressBar: () => null }));
jest.mock('@/components/theme/Button', () => ({
  Button: ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button disabled={disabled} onClick={onPress}>
      {label}
    </button>
  ),
}));
// Rendered as a button so the Clear action of BirthdayNotes can be pressed.
jest.mock('@/components/theme/TextButton', () => ({
  TextButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
}));
jest.mock('@/components/theme/Chip', () => ({ Chip: () => null }));
jest.mock('@/components/theme/TextInput', () => ({ TextInput: () => null }));
jest.mock('@/components/theme/StepperInlineInput', () => ({ StepperInlineInput: () => null }));
jest.mock('@/components/modals/HeightPickerInput', () => ({ HeightPickerInput: () => null }));
jest.mock('@/components/modals/HeightPickerModal', () => ({ HeightPickerModal: () => null }));
// The calendar is covered elsewhere. "confirm untouched" is a person pressing Confirm without
// choosing a day, so it hands back whatever the calendar opened on.
jest.mock('@/components/modals/DatePickerModal', () => ({
  DatePickerModal: ({
    visible,
    selectedDate,
    onDateSelect,
  }: {
    visible: boolean;
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
  }) =>
    visible ? (
      <div>
        <button onClick={() => onDateSelect(selectedDate)}>confirm untouched</button>
        <button onClick={() => onDateSelect(new Date(1995, 4, 5))}>pick adult</button>
        <button onClick={() => onDateSelect(new Date(2014, 4, 5))}>pick minor</button>
      </div>
    ) : null,
}));

jest.mock('@/database/services/UserService', () => ({
  UserService: {
    getCurrentUser: jest.fn(async () => null),
    initializeUser: (data: { dateOfBirth: number | null }) => mockInitializeUser(data),
    updateUserProfile: jest.fn(),
  },
}));
jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: { createMetric: jest.fn(async () => undefined) },
}));
jest.mock('@/hooks/useHealthBodyMetricsPrefill', () => ({
  getHealthBodyMetricsPrefill: jest.fn(async () => ({ weight: '80', height: '180' })),
}));
jest.mock('@/services/onboardingAnswersApply', () => ({
  commitOnboardingProfile: (answers: Record<string, unknown>) => mockCommitProfile(answers),
}));
jest.mock('@/utils/onboardingService', () => ({ setCurrentOnboardingStep: jest.fn() }));
jest.mock('@/utils/onboardingDraft', () => ({
  pickBodyStats: (answers: object) => answers,
  readBodyStatsDraft: () => mockReadBodyStatsDraft(),
  readPersonalizedSetup: jest.fn(async () => ({})),
  writeBodyStatsDraft: jest.fn(async () => undefined),
}));

const PLACEHOLDER = 'editPersonalInfo.dateOfBirthPlaceholder';
const UNDER_AGE = 'common.ageGate.minimumApp';
const CLEAR = 'common.clear';
const CONTINUE = 'onboarding.quickBodyStats.continue';

const continueButton = () => screen.getByText(CONTINUE) as HTMLButtonElement;

/** Renders and lets the screen's load effect (saved answers, Health prefill) finish. */
async function renderLoaded(element: React.ReactElement) {
  await act(async () => {
    render(element);
  });
}

async function press(label: string) {
  await act(async () => {
    fireEvent.click(screen.getByText(label));
  });
}

describe.each([
  ['quick', QuickBodyStatsScreen],
  ['personalized', PersonalizedBodyStatsScreen],
])('%s body stats: the birthday', (_name, Screen) => {
  beforeEach(() => jest.clearAllMocks());

  it('starts empty, and Continue needs only weight and height', async () => {
    await renderLoaded(<Screen />);

    expect(screen.getByText(PLACEHOLDER)).toBeTruthy();
    expect(screen.queryByText(UNDER_AGE)).toBeNull();
    expect(screen.queryByText(CLEAR)).toBeNull();
    expect(continueButton().disabled).toBe(false);
  });

  it('records nothing when the calendar is confirmed untouched', async () => {
    await renderLoaded(<Screen />);

    await press(PLACEHOLDER);
    await press('confirm untouched');

    expect(screen.getByText(PLACEHOLDER)).toBeTruthy();
    expect(screen.queryByText(UNDER_AGE)).toBeNull();
    expect(continueButton().disabled).toBe(false);
  });

  it('continues once an adult birthday is chosen', async () => {
    await renderLoaded(<Screen />);

    await press(PLACEHOLDER);
    await press('pick adult');

    expect(screen.queryByText(PLACEHOLDER)).toBeNull();
    expect(continueButton().disabled).toBe(false);
  });

  it('tells a person under 16 and still lets them continue', async () => {
    await renderLoaded(<Screen />);

    await press(PLACEHOLDER);
    await press('pick minor');

    expect(screen.getByText(UNDER_AGE)).toBeTruthy();
    expect(continueButton().disabled).toBe(false);
  });

  it('removes a chosen birthday with Clear, and the placeholder comes back', async () => {
    await renderLoaded(<Screen />);

    await press(PLACEHOLDER);
    await press('pick adult');
    await press(CLEAR);

    expect(screen.getByText(PLACEHOLDER)).toBeTruthy();
    expect(screen.queryByText(CLEAR)).toBeNull();
    expect(continueButton().disabled).toBe(false);
  });
});

describe('what is saved', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is the chosen birthday in the quick setup', async () => {
    await renderLoaded(<QuickBodyStatsScreen />);

    await press(PLACEHOLDER);
    await press('pick adult');
    await press(CONTINUE);

    expect(mockInitializeUser).toHaveBeenCalledWith(
      expect.objectContaining({ dateOfBirth: localDayStartMs(new Date(1995, 4, 5)) })
    );
  });

  it('is null in the quick setup when no birthday was given', async () => {
    await renderLoaded(<QuickBodyStatsScreen />);

    await press(CONTINUE);

    expect(mockInitializeUser).toHaveBeenCalledWith(expect.objectContaining({ dateOfBirth: null }));
  });

  it('is the chosen birthday in the personalized setup, even under 16', async () => {
    await renderLoaded(<PersonalizedBodyStatsScreen />);

    await press(PLACEHOLDER);
    await press('pick minor');
    await press(CONTINUE);

    expect(mockCommitProfile).toHaveBeenCalledWith(
      expect.objectContaining({ birthDate: '2014-05-05' })
    );
  });

  it('has no birthDate at all in the personalized setup when none was given', async () => {
    await renderLoaded(<PersonalizedBodyStatsScreen />);

    await press(CONTINUE);

    expect(mockCommitProfile).toHaveBeenCalledTimes(1);
    expect(mockCommitProfile.mock.calls[0][0]).not.toHaveProperty('birthDate');
  });

  it('restores a birthday the person already gave', async () => {
    mockReadBodyStatsDraft.mockResolvedValueOnce({ birthDate: '1988-03-02' });

    await renderLoaded(<PersonalizedBodyStatsScreen />);

    expect(screen.queryByText(PLACEHOLDER)).toBeNull();
    expect(continueButton().disabled).toBe(false);
  });
});

describe('the birthday editor of the AI setup review', () => {
  it('shows no date until one is given, and takes none from an untouched calendar', async () => {
    const onChange = jest.fn();
    await renderLoaded(
      <ReviewFieldEditor
        field="birthDate"
        draft={{}}
        units="metric"
        onChange={onChange}
        onDone={jest.fn()}
      />
    );

    await press(PLACEHOLDER);
    await press('confirm untouched');

    expect(screen.getByText(PLACEHOLDER)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});
