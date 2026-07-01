import type { Dispatch, SetStateAction } from 'react';

// BottomPopUpMenu always calls onClose right after an item's own onPress, even when that
// onPress already moved the dialog to a different value (e.g. a menu item opening a details
// modal). Only clear the dialog if it's still showing the menu, so this doesn't clobber that
// transition.
export function closeMenuDialog<T extends string>(
  setDialog: Dispatch<SetStateAction<T | 'menu' | null>>
): void {
  setDialog((current) => (current === 'menu' ? null : current));
}
