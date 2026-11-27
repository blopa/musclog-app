import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { VoiceWeightSheet, type VoiceWeighIn } from '@/components/modals/VoiceWeightSheet';
import { UserMetricService } from '@/database/services/UserMetricService';

const mockCreateMetric = jest.fn();
jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: { createMetric: (...args: unknown[]) => mockCreateMetric(...args) },
}));
jest.mock('@/lang/lang', () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en-US' } }),
}));
jest.mock('@/utils/timezone', () => ({ getCurrentTimezone: () => 'UTC' }));
let mockUnits: 'metric' | 'imperial' = 'metric';
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ units: mockUnits }),
}));
jest.mock('@/utils/snackbarService', () => ({ showSnackbar: jest.fn() }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/components/BottomPopUp', () => ({
  BottomPopUp: ({
    title,
    footer,
    children,
    onClose,
  }: {
    title: string;
    footer: React.ReactNode;
    children: React.ReactNode;
    onClose: () => void;
  }) => (
    <div>
      <h2>{title}</h2>
      <button onClick={onClose}>dismiss</button>
      {children}
      {footer}
    </div>
  ),
}));
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
jest.mock('@/components/theme/NumericTextField', () => ({
  NumericTextField: ({
    value,
    onChangeText,
    accessibilityLabel,
  }: {
    value: string;
    onChangeText: (text: string) => void;
    accessibilityLabel: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      value={value}
      onChange={(event) => onChangeText(event.target.value)}
    />
  ),
}));
jest.mock('@/components/theme/SegmentedControl', () => ({
  SegmentedControl: ({
    options,
    onValueChange,
  }: {
    options: { value: string; label: string }[];
    onValueChange: (value: string) => void;
  }) => (
    <div>
      {options.map((option) => (
        <button key={option.value} onClick={() => onValueChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

const DAY = new Date(2026, 10, 26);

function weighIn(overrides: Partial<VoiceWeighIn> = {}): VoiceWeighIn {
  return { kind: 'logWeight', day: DAY, weightKg: 80, ...overrides };
}

function renderSheet(value: VoiceWeighIn = weighIn()) {
  const onClose = jest.fn();
  render(<VoiceWeightSheet weighIn={value} onClose={onClose} />);

  return { onClose };
}

const field = () => screen.getByLabelText('voiceInput.command.weight.field') as HTMLInputElement;

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateMetric.mockResolvedValue(undefined);
});

describe('VoiceWeightSheet', () => {
  beforeEach(() => {
    mockUnits = 'metric';
  });

  it('starts with the spoken value in kilograms on a metric account', () => {
    renderSheet(weighIn({ weightKg: 80.5 }));

    expect(field().value).toBe('80.5');
    expect(screen.getByText('workoutSession.kg')).toBeTruthy();
  });

  it('starts empty when no weight could be read', () => {
    renderSheet(weighIn({ weightKg: null }));

    expect(field().value).toBe('');
  });

  it('shows the kilogram weight in pounds on an imperial account, with the pound label', () => {
    mockUnits = 'imperial';
    renderSheet(weighIn({ weightKg: 82.1 }));

    expect(Math.abs(Number(field().value) - 181)).toBeLessThan(0.5);
    expect(screen.getByText('workoutSession.lb')).toBeTruthy();
    expect(screen.queryByText('workoutSession.kg')).toBeNull();
  });

  it('has no unit toggle, whatever the account unit', () => {
    mockUnits = 'imperial';
    renderSheet(weighIn({ weightKg: 82.1 }));

    expect(screen.queryByText('voiceInput.command.weight.kg')).toBeNull();
    expect(screen.queryByText('voiceInput.command.weight.lb')).toBeNull();
  });

  it('writes exactly one kg weight entry on the day said and closes saved', async () => {
    const { onClose } = renderSheet();

    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(mockCreateMetric).toHaveBeenCalledTimes(1);
    expect(mockCreateMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'weight',
        unit: 'kg',
        value: 80,
        timezone: 'UTC',
        date: DAY.getTime(),
      })
    );
  });

  it('on an imperial account saves the typed pounds as kilograms via displayToKg', async () => {
    mockUnits = 'imperial';
    const { onClose } = renderSheet(weighIn({ weightKg: 82.1 }));

    fireEvent.change(field(), { target: { value: '181' } });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    const { value, unit } = mockCreateMetric.mock.calls[0][0];
    expect(unit).toBe('kg');
    expect(value).toBeCloseTo(82.1, 1);
  });

  it('disables Save for an empty or invalid value and writes nothing', () => {
    renderSheet(weighIn({ weightKg: null }));
    const save = screen.getByText('common.save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(field(), { target: { value: 'abc' } });
    expect((screen.getByText('common.save') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByText('common.save'));
    expect(mockCreateMetric).not.toHaveBeenCalled();
  });

  it('disables Save for zero', () => {
    renderSheet(weighIn({ weightKg: 0 }));

    expect((screen.getByText('common.save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('closes unsaved when dismissed', () => {
    const { onClose } = renderSheet();

    fireEvent.click(screen.getByText('dismiss'));

    expect(onClose).toHaveBeenCalledWith(false);
    expect(mockCreateMetric).not.toHaveBeenCalled();
  });
});
