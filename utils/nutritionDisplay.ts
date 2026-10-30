/**
 * Which macros the nutrition cards show, stored as a 5-character binary string in the
 * `nutrition_display` setting. Position `i` is `NUTRITION_DISPLAY_MACROS[i]`; '1' = shown.
 * One definition for the settings modal and anything else that flips it.
 */

/** Ordered macro keys — the index maps to the binary string position. */
export const NUTRITION_DISPLAY_MACROS = ['carbs', 'protein', 'fats', 'fiber', 'alcohol'] as const;
export type NutritionDisplayMacro = (typeof NUTRITION_DISPLAY_MACROS)[number];

export const NUTRITION_DISPLAY_ALL = '11111';

/** Convert a binary string to the visible macro keys. */
export function binaryToSelectedMacros(binary: string): NutritionDisplayMacro[] {
  return NUTRITION_DISPLAY_MACROS.filter((_, i) => binary[i] === '1');
}

/** Convert visible macro keys back to a 5-char binary string. */
export function selectedMacrosToBinary(selected: readonly NutritionDisplayMacro[]): string {
  return NUTRITION_DISPLAY_MACROS.map((key) => (selected.includes(key) ? '1' : '0')).join('');
}

/** Only protein shown: the gentlest view for someone who is restarting tracking. */
export const NUTRITION_DISPLAY_PROTEIN_ONLY = selectedMacrosToBinary(['protein']);

export function isProteinOnlyDisplay(binary: string): boolean {
  return binary === NUTRITION_DISPLAY_PROTEIN_ONLY;
}
