/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { parseMicronutrientFormStringsToPartial } from '@/components/MicronutrientsExpandableSection';
import { type EditFormState, useFoodEditForm } from '@/hooks/useFoodEditForm';

// The real parser lives in a `.tsx` component module; only its call contract matters here.
jest.mock('@/components/MicronutrientsExpandableSection', () => ({
  parseMicronutrientFormStringsToPartial: jest.fn(() => ({ sodium: 120 })),
}));

const mockParseMicros = parseMicronutrientFormStringsToPartial as jest.Mock;

const makeForm = (overrides: Partial<EditFormState> = {}): EditFormState =>
  ({
    barcode: ' 012345 ',
    calories: '250,5',
    carbs: '30',
    description: ' A description ',
    fat: '10',
    fiber: '3',
    micronutrients: { sodium: '120' },
    name: '  Greek yogurt  ',
    protein: '12',
    ...overrides,
  }) as EditFormState;

const render = ({
  decimalSeparator = ',' as ',' | '.',
  inferredCaloriesPer100g = 0,
} = {}) =>
  renderHook(() => useFoodEditForm({ decimalSeparator, inferredCaloriesPer100g }));

describe('useFoodEditForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParseMicros.mockReturnValue({ sodium: 120 });
  });

  it('opens with the supplied draft and always starts with the micro section collapsed', () => {
    const { result } = render();

    act(() => result.current.setEditMicroOpen(true));
    act(() => result.current.openEditPopUp(makeForm()));

    expect(result.current.isEditPopUpVisible).toBe(true);
    expect(result.current.editForm?.name).toBe('  Greek yogurt  ');
    expect(result.current.editMicroOpen).toBe(false);
  });

  it('parses the draft with the locale separator into numeric overrides and closes the pop-up', () => {
    const { result } = render({ decimalSeparator: ',' });

    act(() => result.current.openEditPopUp(makeForm({ calories: '1.234,5' })));
    act(() => result.current.saveEditPopUp());

    expect(result.current.editedOverrides).toEqual({
      barcode: '012345',
      calories: 1234.5,
      carbs: 30,
      description: 'A description',
      fat: 10,
      fiber: 3,
      micros: { sodium: 120 },
      name: 'Greek yogurt',
      protein: 12,
    });
    expect(mockParseMicros).toHaveBeenCalledWith({ sodium: '120' }, ',');
    expect(result.current.isEditPopUpVisible).toBe(false);
    expect(result.current.editForm).toBeNull();
  });

  it('drops blank text fields to undefined so they never overwrite the source food', () => {
    const { result } = render();

    act(() => result.current.openEditPopUp(makeForm({ barcode: '   ', description: '' })));
    act(() => result.current.saveEditPopUp());

    expect(result.current.editedOverrides?.barcode).toBeUndefined();
    expect(result.current.editedOverrides?.description).toBeUndefined();
    expect(result.current.editedOverrides?.name).toBe('Greek yogurt');
  });

  // Blank numerics are *not* symmetric with blank text: the localized parser yields 0 (a finite
  // number), so an emptied macro field saves as an explicit zero rather than "leave as-is".
  it('saves an emptied numeric field as an explicit zero', () => {
    const { result } = render();

    act(() => result.current.openEditPopUp(makeForm({ fiber: '' })));
    act(() => result.current.saveEditPopUp());

    expect(result.current.editedOverrides?.fiber).toBe(0);
  });

  it('ignores a save with no draft open', () => {
    const { result } = render();

    act(() => result.current.saveEditPopUp());

    expect(result.current.editedOverrides).toBeNull();
    expect(mockParseMicros).not.toHaveBeenCalled();
  });

  it('sanitizes numeric input to digits plus the locale separator, capped at two decimals', () => {
    const { result } = render({ decimalSeparator: ',' });

    act(() => result.current.openEditPopUp(makeForm()));
    act(() => result.current.handleEditFormNumericChange('protein')('12a,3456'));

    expect(result.current.editForm?.protein).toBe('12,34');
  });

  it('ignores numeric input when no draft is open', () => {
    const { result } = render();

    act(() => result.current.handleEditFormNumericChange('calories')('99'));

    expect(result.current.editForm).toBeNull();
  });

  it('accepts the inferred calories without discarding the other overrides', () => {
    const { result } = render({ inferredCaloriesPer100g: 123.456 });

    act(() => result.current.openEditPopUp(makeForm()));
    act(() => result.current.saveEditPopUp());
    act(() => result.current.acceptInferredCalories());

    expect(result.current.editedOverrides?.calories).toBe(123.46);
    expect(result.current.editedOverrides?.protein).toBe(12);
  });

  it('keeps saved overrides when only the pop-up is closed, and drops them on reset', () => {
    const { result } = render();

    act(() => result.current.openEditPopUp(makeForm()));
    act(() => result.current.saveEditPopUp());
    act(() => result.current.openEditPopUp(makeForm({ name: 'Second draft' })));
    act(() => result.current.closeEditPopUp());

    expect(result.current.editForm).toBeNull();
    expect(result.current.isEditPopUpVisible).toBe(false);
    expect(result.current.editedOverrides?.name).toBe('Greek yogurt');

    act(() => result.current.reset());

    expect(result.current.editedOverrides).toBeNull();
    expect(result.current.editMicroOpen).toBe(false);
  });
});
