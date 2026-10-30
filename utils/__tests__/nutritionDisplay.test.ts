import {
  binaryToSelectedMacros,
  isProteinOnlyDisplay,
  NUTRITION_DISPLAY_ALL,
  NUTRITION_DISPLAY_PROTEIN_ONLY,
  selectedMacrosToBinary,
} from '@/utils/nutritionDisplay';

describe('nutritionDisplay', () => {
  it('round-trips every macro', () => {
    expect(binaryToSelectedMacros(NUTRITION_DISPLAY_ALL)).toEqual([
      'carbs',
      'protein',
      'fats',
      'fiber',
      'alcohol',
    ]);
    expect(selectedMacrosToBinary(binaryToSelectedMacros('10110'))).toBe('10110');
  });

  it('names the protein-only display', () => {
    expect(NUTRITION_DISPLAY_PROTEIN_ONLY).toBe('01000');
    expect(isProteinOnlyDisplay('01000')).toBe(true);
    expect(isProteinOnlyDisplay('11111')).toBe(false);
  });
});
