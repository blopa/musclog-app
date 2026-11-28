import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CardioLogService } from '@/database/services/CardioLogService';
import { LogCardioModal, type LogCardioInitial } from '@/components/modals/LogCardioModal';

let mockUnits: 'metric' | 'imperial' = 'metric';

jest.mock('@/lang/lang', () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ units: mockUnits }),
}));
jest.mock('@/hooks/useFormatAppNumber', () => ({
  useFormatAppNumber: () => ({ locale: 'en-US' }),
}));
jest.mock('@/hooks/useEnergyUnit', () => ({
  useEnergyUnit: () => ({ formatEnergyWithUnit: (kcal: number) => `${kcal} kcal` }),
}));
jest.mock('@/context/SnackbarContext', () => ({
  useSnackbar: () => ({ showSnackbar: jest.fn() }),
}));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/database/services/CardioLogService', () => ({
  CardioLogService: { logCardioSession: jest.fn(async () => undefined) },
}));
jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: { getUserBodyWeightKgForVolume: jest.fn(async () => 0) },
}));
jest.mock('@/components/modals/FullScreenModal', () => ({
  FullScreenModal: ({
    visible,
    footer,
    children,
  }: {
    visible: boolean;
    footer: React.ReactNode;
    children: React.ReactNode;
  }) =>
    visible ? (
      <div>
        {children}
        {footer}
      </div>
    ) : null,
}));
jest.mock('@/components/theme/StepperInput', () => ({
  StepperInput: ({
    label,
    value,
    onChangeValue,
  }: {
    label: string;
    value: number;
    onChangeValue?: (value: number) => void;
  }) => (
    <div>
      <div data-testid={label}>{value}</div>
      {onChangeValue ? (
        <button aria-label={`increase ${label}`} onClick={() => onChangeValue(value + 1)} />
      ) : null}
    </div>
  ),
}));
jest.mock('@/components/FilterTabs', () => ({ FilterTabs: () => null }));
jest.mock('@/components/theme/ToggleInput', () => ({ ToggleInput: () => null }));
jest.mock('@/components/modals/DatePickerInput', () => ({ DatePickerInput: () => null }));
jest.mock('@/components/modals/DatePickerModal', () => ({ DatePickerModal: () => null }));
jest.mock('@/components/modals/TimePickerInput', () => ({ TimePickerInput: () => null }));
jest.mock('@/components/modals/TimePickerModal', () => ({ TimePickerModal: () => null }));
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

const logCardioSession = CardioLogService.logCardioSession as jest.Mock;

const PAST_END = new Date(2026, 0, 10, 9, 30, 0, 0);

function renderModal(initial?: LogCardioInitial) {
  render(<LogCardioModal visible onClose={jest.fn()} initial={initial} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUnits = 'metric';
});

describe('LogCardioModal', () => {
  it('shows the metric distance from initial metres', () => {
    mockUnits = 'metric';
    renderModal({ activity: 'run', distanceM: 4828.032, durationS: null, endedAt: PAST_END });

    const shown = Number(screen.getByTestId('cardio.distanceInput').textContent);
    expect(shown).toBeCloseTo(4.828032, 6);
  });

  it('shows the imperial distance from initial metres', () => {
    mockUnits = 'imperial';
    renderModal({ activity: 'run', distanceM: 4828.032, durationS: null, endedAt: PAST_END });

    const shown = Number(screen.getByTestId('cardio.distanceInput').textContent);
    expect(shown).toBeCloseTo(3, 6);
  });

  it('splits initial durationS into hours, minutes and seconds', () => {
    renderModal({ activity: 'walk', distanceM: 5000, durationS: 3900, endedAt: PAST_END });

    expect(screen.getByTestId('cardio.hours').textContent).toBe('1');
    expect(screen.getByTestId('cardio.minutes').textContent).toBe('5');
    expect(screen.getByTestId('cardio.seconds').textContent).toBe('0');
  });

  it.each([
    ['distance', null, 1800],
    ['duration', 5000, null],
    ['both', null, null],
  ] as const)(
    'shows the missing distance and time when %s was not said',
    (missing, distanceM, durationS) => {
      renderModal({ activity: 'run', distanceM, durationS, endedAt: PAST_END });

      if (distanceM === null) {
        expect(screen.getByTestId('cardio.distanceInput').textContent).toBe('0');
      }
      if (durationS === null) {
        expect(screen.getByTestId('cardio.minutes').textContent).toBe('0');
      }

      const save = screen.getByText('cardio.save');
      expect((save as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText('cardio.needsDistanceAndTime')).toBeTruthy();
      expect(logCardioSession).not.toHaveBeenCalled();
    }
  );

  it('clears the missing-values message as soon as the draft becomes valid', () => {
    renderModal({ activity: 'run', distanceM: 5000, durationS: null, endedAt: PAST_END });
    expect(screen.getByText('cardio.needsDistanceAndTime')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'increase cardio.minutes' }));

    expect(screen.queryByText('cardio.needsDistanceAndTime')).toBeNull();
    expect((screen.getByText('cardio.save') as HTMLButtonElement).disabled).toBe(false);
  });

  it('saves a valid initial log with its exact distance, duration, activity and end time', async () => {
    renderModal({ activity: 'walk', distanceM: 5000, durationS: 1800, endedAt: PAST_END });

    fireEvent.click(screen.getByText('cardio.save'));

    await waitFor(() => expect(logCardioSession).toHaveBeenCalledTimes(1));
    expect(logCardioSession).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: 'walk',
        distanceM: 5000,
        durationS: 1800,
        endedAt: PAST_END.getTime(),
      })
    );
  });

  it('keeps the defaults when no initial is given', () => {
    renderModal();

    expect(screen.getByTestId('cardio.distanceInput').textContent).toBe('5');
    expect(screen.getByTestId('cardio.minutes').textContent).toBe('30');
    expect(screen.getByTestId('cardio.hours').textContent).toBe('0');
    expect(screen.getByTestId('cardio.seconds').textContent).toBe('0');
    expect(screen.queryByText('cardio.needsDistanceAndTime')).toBeNull();
  });
});
