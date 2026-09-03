import type { Theme } from '@/theme';

/**
 * The bottom-sheet / centered-modal surface color, split out of BottomPopUp so
 * it can be imported without pulling in React Native component code (and its
 * native modules) — cardSurface.test.ts asserts GenericCard's 'raised' variant
 * never matches this fill, since a raised card would disappear into the sheet
 * behind it.
 */
export function sheetSurfaceColor(theme: Theme): string {
  return theme.colors.background.cardElevated;
}
