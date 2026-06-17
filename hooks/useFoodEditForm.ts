import { useCallback, useState } from 'react';

import {
  type MicronutrientFormStrings,
  parseMicronutrientFormStringsToPartial,
} from '@/components/MicronutrientsExpandableSection';
import type { EditedFoodOverrides } from '@/types/foodEditing';
import {
  parseLocalizedDecimalString,
  sanitizeLocalizedDecimalInput,
} from '@/utils/localizedDecimalInput';
import { roundToDecimalPlaces } from '@/utils/roundDecimal';

export type EditedOverrides = EditedFoodOverrides;

/** String-backed form state for the edit pop-up (localized decimals, free-form text). */
export type EditFormState = {
  name: string;
  barcode: string;
  description: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  micronutrients: MicronutrientFormStrings;
};

/** Numeric macro fields handled by {@link useFoodEditForm}'s localized-decimal change handler. */
type NumericField = 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber';

type UseFoodEditFormParams = {
  decimalSeparator: ',' | '.';
  inferredCaloriesPer100g: number;
};

/**
 * Owns the food edit-pop-up state cluster (`editedOverrides`, `editForm`, visibility,
 * micro-section open) and the logic that is identical across the food-details modals:
 * parsing the form into overrides, accepting inferred calories, and localized numeric input.
 *
 * Each modal gathers its own initial {@link EditFormState} (the source fields differ) and hands
 * it to {@link openEditPopUp}; everything after that is shared here.
 */
export function useFoodEditForm({
  decimalSeparator,
  inferredCaloriesPer100g,
}: UseFoodEditFormParams) {
  const [editedOverrides, setEditedOverrides] = useState<EditedOverrides | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [isEditPopUpVisible, setIsEditPopUpVisible] = useState(false);
  const [editMicroOpen, setEditMicroOpen] = useState(false);

  const openEditPopUp = useCallback((initialForm: EditFormState) => {
    setEditForm(initialForm);
    setEditMicroOpen(false);
    setIsEditPopUpVisible(true);
  }, []);

  const closeEditPopUp = useCallback(() => {
    setEditForm(null);
    setIsEditPopUpVisible(false);
    setEditMicroOpen(false);
  }, []);

  const saveEditPopUp = useCallback(() => {
    if (!editForm) {
      return;
    }

    const cal = parseLocalizedDecimalString(editForm.calories, decimalSeparator);
    const pro = parseLocalizedDecimalString(editForm.protein, decimalSeparator);
    const carb = parseLocalizedDecimalString(editForm.carbs, decimalSeparator);
    const f = parseLocalizedDecimalString(editForm.fat, decimalSeparator);
    const fib = parseLocalizedDecimalString(editForm.fiber, decimalSeparator);

    setEditedOverrides({
      name: editForm.name.trim() || undefined,
      barcode: editForm.barcode.trim() || undefined,
      description: editForm.description.trim() || undefined,
      calories: Number.isFinite(cal) ? cal : undefined,
      protein: Number.isFinite(pro) ? pro : undefined,
      carbs: Number.isFinite(carb) ? carb : undefined,
      fat: Number.isFinite(f) ? f : undefined,
      fiber: Number.isFinite(fib) ? fib : undefined,
      micros: parseMicronutrientFormStringsToPartial(editForm.micronutrients, decimalSeparator),
    });
    setEditForm(null);
    setIsEditPopUpVisible(false);
  }, [editForm, decimalSeparator]);

  const acceptInferredCalories = useCallback(() => {
    setEditedOverrides((prev) => ({
      ...prev,
      calories: roundToDecimalPlaces(inferredCaloriesPer100g, 2),
    }));
  }, [inferredCaloriesPer100g]);

  const handleEditFormNumericChange = useCallback(
    (field: NumericField) => (value: string) => {
      const numericValue = sanitizeLocalizedDecimalInput(value, decimalSeparator, 2);
      setEditForm((prev) => (prev ? { ...prev, [field]: numericValue } : null));
    },
    [decimalSeparator]
  );

  /** Clears all edit state — call when the host modal closes. */
  const reset = useCallback(() => {
    setEditedOverrides(null);
    setEditForm(null);
    setIsEditPopUpVisible(false);
    setEditMicroOpen(false);
  }, []);

  return {
    editedOverrides,
    editForm,
    setEditForm,
    isEditPopUpVisible,
    editMicroOpen,
    setEditMicroOpen,
    openEditPopUp,
    closeEditPopUp,
    saveEditPopUp,
    acceptInferredCalories,
    handleEditFormNumericChange,
    reset,
  };
}
