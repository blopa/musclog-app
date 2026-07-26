/**
 * Geometry for deciding how far a bottom sheet has to rise so the on-screen keyboard
 * does not cover it. Every value is in the same coordinate space (dp, screen origin) and
 * describes the sheet at rest — i.e. with any lift currently applied already subtracted.
 */
export type KeyboardSheetLiftInput = {
  /** Top edge of the keyboard. */
  keyboardTop: number;
  /** Top edge of the sheet with no lift applied. */
  sheetTop: number;
  /** Height of the sheet. */
  sheetHeight: number;
  /** Bottom edge of the focused input with no lift applied, or null when nothing is focused. */
  focusedInputBottom: null | number;
  /** Highest the sheet's top may go — above this its header would leave the screen. */
  minSheetTop: number;
  /** Breathing room kept between the focused input and the keyboard. */
  inputGap: number;
};

/**
 * Lifting only far enough to clear the focused input leaves whatever sits below it — submit
 * buttons, footers — hidden behind the keyboard, so the whole sheet is lifted clear instead.
 * A sheet too tall to fit above the keyboard is lifted as far as its header allows, except
 * that showing the focused input always wins: not seeing what you type is worse than losing
 * the header off the top of the screen.
 */
export function computeKeyboardSheetLift({
  keyboardTop,
  sheetTop,
  sheetHeight,
  focusedInputBottom,
  minSheetTop,
  inputGap,
}: KeyboardSheetLiftInput): number {
  const liftToClearSheet = sheetTop + sheetHeight - keyboardTop;
  const maxLift = Math.max(0, sheetTop - minSheetTop);
  const liftToClearInput =
    focusedInputBottom === null ? 0 : focusedInputBottom + inputGap - keyboardTop;

  return Math.max(0, liftToClearInput, Math.min(liftToClearSheet, maxLift));
}
