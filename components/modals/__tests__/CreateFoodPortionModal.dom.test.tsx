import { fireEvent, render, screen } from '@testing-library/react';

import { CreateFoodPortionModal } from '@/components/modals/CreateFoodPortionModal';

let mockUnits: 'metric' | 'imperial' = 'metric';

jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ units: mockUnits }),
}));
jest.mock('@/hooks/useFormatAppNumber', () => ({
  useFormatAppNumber: () => ({ locale: 'en-US' }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { unit?: string }) =>
      key === 'weightInUnit'
        ? `weight (${options?.unit})`
        : ({ 'food.unitOz': 'oz', 'food.unitGrams': 'g' }[key] ?? key),
  }),
}));
jest.mock('@/utils/avatarUtils', () => ({ getAvatarIcon: () => null }));
jest.mock('@/components/AvatarSelector', () => ({ AvatarSelector: () => null }));
jest.mock('@/components/modals/FullScreenModal', () => ({
  FullScreenModal: ({
    title,
    footer,
    children,
  }: {
    title: string;
    footer: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      <h2>{title}</h2>
      {children}
      {footer}
    </div>
  ),
}));
jest.mock('@/components/theme/Button', () => ({
  Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
}));
jest.mock('@/components/theme/TextInput', () => ({
  TextInput: ({
    label,
    value,
    onChangeText,
  }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
  }) => (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChangeText(event.target.value)}
    />
  ),
}));
jest.mock('@/components/theme/StepperInput', () => ({
  StepperInput: ({
    label,
    value,
    unit,
    maxFractionDigits,
    onChangeValue,
  }: {
    label: string;
    value: number;
    unit: string;
    maxFractionDigits: number;
    onChangeValue: (entered: number) => void;
  }) => (
    <div>
      <span>{`${label} ${unit}`}</span>
      <input
        aria-label={`stepper ${label}`}
        value={String(Number(value.toFixed(maxFractionDigits)))}
        onChange={(event) => onChangeValue(Number(event.target.value))}
      />
    </div>
  ),
}));

function renderModal() {
  const onCreatePortion = jest.fn();
  const onClose = jest.fn();
  render(<CreateFoodPortionModal visible onClose={onClose} onCreatePortion={onCreatePortion} />);

  return { onCreatePortion, onClose };
}

beforeEach(() => {
  mockUnits = 'metric';
});

describe('CreateFoodPortionModal', () => {
  it('shows grams with the gram label on a metric account', () => {
    renderModal();

    expect(screen.getByText('weight (g) g')).toBeTruthy();
    expect((screen.getByLabelText('stepper weight (g)') as HTMLInputElement).value).toBe('100');
  });

  it('shows ounces on an imperial account and still reports grams', () => {
    mockUnits = 'imperial';
    const { onCreatePortion, onClose } = renderModal();

    expect(screen.getByText('weight (oz) oz')).toBeTruthy();
    expect((screen.getByLabelText('stepper weight (oz)') as HTMLInputElement).value).toBe('3.5');

    fireEvent.change(screen.getByLabelText('portionName'), { target: { value: 'Bagel' } });
    fireEvent.click(screen.getByText('createPortion'));

    expect(onCreatePortion).toHaveBeenCalledWith({
      name: 'Bagel',
      weight: 100,
      icon: 'ramen-dining',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('converts a typed ounce value to grams for the portion', () => {
    mockUnits = 'imperial';
    const { onCreatePortion } = renderModal();

    fireEvent.change(screen.getByLabelText('portionName'), { target: { value: 'Oats' } });
    fireEvent.change(screen.getByLabelText('stepper weight (oz)'), { target: { value: '4' } });
    fireEvent.click(screen.getByText('createPortion'));

    expect(onCreatePortion).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Oats', weight: expect.closeTo(113.4, 1) })
    );
  });

  it('keeps grams unchanged on a metric account', () => {
    const { onCreatePortion } = renderModal();

    fireEvent.change(screen.getByLabelText('portionName'), { target: { value: 'Rice' } });
    fireEvent.change(screen.getByLabelText('stepper weight (g)'), { target: { value: '250' } });
    fireEvent.click(screen.getByText('createPortion'));

    expect(onCreatePortion).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Rice', weight: 250 })
    );
  });
});
