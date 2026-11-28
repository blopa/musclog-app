/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CopyDayFromHistoryModal } from '@/components/modals/CopyDayFromHistoryModal';
import { useCopyDaySource } from '@/hooks/useCopyDaySource';
import { utcDayKeyFromLocalDate } from '@/utils/calendarDate';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/hooks/useEnergyUnit', () => ({
  useEnergyUnit: () => ({ formatEnergyWithUnit: (kcal: number) => `${kcal} kcal` }),
}));
jest.mock('@/hooks/useFormatAppNumber', () => ({
  useFormatAppNumber: () => ({ locale: 'en-US' }),
}));
jest.mock('@/hooks/useSubModalVisibility', () => ({
  useSubModalVisibility: () => [false, jest.fn()],
}));
jest.mock('@/hooks/useCopyDaySource', () => ({
  useCopyDaySource: jest.fn(),
}));
jest.mock('@/utils/flushLoadingPaint', () => ({ flushLoadingPaint: () => Promise.resolve() }));
jest.mock('@/components/BottomPopUp', () => ({
  BottomPopUp: ({
    visible,
    title,
    footer,
    children,
  }: {
    visible: boolean;
    title: string;
    footer: React.ReactNode;
    children: React.ReactNode;
  }) =>
    visible ? (
      <div>
        <h1>{title}</h1>
        {children}
        {footer}
      </div>
    ) : null,
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
jest.mock('@/components/modals/DatePickerInput', () => ({ DatePickerInput: () => null }));
jest.mock('@/components/modals/DatePickerModal', () => ({ DatePickerModal: () => null }));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.meal ? `${key}:${String(options.meal)}` : key,
    i18n: { language: 'en-US' },
  }),
}));

const mockUseCopyDaySource = useCopyDaySource as jest.Mock;

const TARGET = new Date(2026, 5, 15, 10, 0);
const YESTERDAY = new Date(2026, 5, 14, 10, 0);

const baseSource = {
  recentDays: [],
  isLoadingRecentDays: false,
  sections: [],
  isLoadingPreview: false,
  isSourceEmpty: false,
};

function renderModal(props: Partial<React.ComponentProps<typeof CopyDayFromHistoryModal>> = {}) {
  const onConfirm = jest.fn().mockResolvedValue(undefined);
  const onClose = jest.fn();

  render(
    <CopyDayFromHistoryModal
      visible
      onClose={onClose}
      targetDate={TARGET}
      targetDayItemCount={0}
      onConfirm={onConfirm}
      {...props}
    />
  );

  return { onConfirm, onClose };
}

describe('CopyDayFromHistoryModal meal scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCopyDaySource.mockReturnValue(baseSource);
  });

  it('keeps the generic title and loads no preset day without the new props', () => {
    renderModal();

    expect(screen.getByText('food.actions.copyDayModalTitle')).toBeTruthy();
    expect(screen.queryByText(/food.actions.copyMealTargetNote/)).toBeNull();
    expect(mockUseCopyDaySource).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceDate: null, mealType: undefined })
    );
  });

  it('titles the modal with the scoped meal name', () => {
    renderModal({ sourceMealType: 'breakfast' });

    expect(screen.getByText('food.actions.copyMealTitle:food.meals.breakfast')).toBeTruthy();
    expect(mockUseCopyDaySource).toHaveBeenLastCalledWith(
      expect.objectContaining({ mealType: 'breakfast' })
    );
  });

  it('starts on the preset source day and confirms with that day', async () => {
    mockUseCopyDaySource.mockReturnValue({
      ...baseSource,
      sections: [
        {
          mealType: 'breakfast',
          titleKey: 'food.meals.breakfast',
          items: [{ calories: 300, id: 'l1', kind: 'single', label: 'Oats', logIds: ['l1'] }],
        },
      ],
    });
    const { onConfirm } = renderModal({
      initialSourceDate: YESTERDAY,
      sourceMealType: 'breakfast',
    });

    expect(mockUseCopyDaySource).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sourceDate: expect.any(Date),
        mealType: 'breakfast',
      })
    );
    const preset = mockUseCopyDaySource.mock.calls.at(-1)[0].sourceDate as Date;
    expect(utcDayKeyFromLocalDate(preset)).toBe(utcDayKeyFromLocalDate(YESTERDAY));

    fireEvent.click(screen.getByText('common.confirm'));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    const [confirmedIds, confirmedDate] = onConfirm.mock.calls[0];
    expect(confirmedIds).toEqual(['l1']);
    expect(utcDayKeyFromLocalDate(confirmedDate)).toBe(utcDayKeyFromLocalDate(YESTERDAY));
  });

  it('shows the target meal note only when targetMealType is set', () => {
    renderModal({ targetMealType: 'lunch' });

    expect(screen.getByText('food.actions.copyMealTargetNote:food.meals.lunch')).toBeTruthy();
  });
});
