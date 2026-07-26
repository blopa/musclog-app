import { computeKeyboardSheetLift } from '../keyboardSheetLift';

// Roughly a 876dp-tall phone with a 260dp keyboard, so the numbers below read like real geometry.
const KEYBOARD_TOP = 616;

const baseInput = {
  focusedInputBottom: null as null | number,
  inputGap: 16,
  keyboardTop: KEYBOARD_TOP,
  minSheetTop: 24,
  sheetHeight: 200,
  sheetTop: 628,
};

describe('computeKeyboardSheetLift', () => {
  it('lifts a short sheet until its bottom rests on the keyboard', () => {
    expect(computeKeyboardSheetLift(baseInput)).toBe(212);
  });

  it('keeps lifting the whole sheet when the focused input alone already clears the keyboard', () => {
    // The barcode text search sheet: the input sits just above the keyboard, but the search
    // button below it does not — lifting only for the input would leave the button hidden.
    const lift = computeKeyboardSheetLift({ ...baseInput, focusedInputBottom: 600 });

    expect(lift).toBe(212);
  });

  it('does not lift when the sheet already sits above the keyboard', () => {
    const lift = computeKeyboardSheetLift({
      ...baseInput,
      sheetHeight: 100,
      sheetTop: 400,
    });

    expect(lift).toBe(0);
  });

  it('stops lifting before the sheet header leaves the screen', () => {
    const lift = computeKeyboardSheetLift({
      ...baseInput,
      sheetHeight: 800,
      sheetTop: 28,
    });

    expect(lift).toBe(4);
  });

  it('lifts past the header when that is the only way to show the focused input', () => {
    const lift = computeKeyboardSheetLift({
      ...baseInput,
      focusedInputBottom: 780,
      sheetHeight: 800,
      sheetTop: 28,
    });

    expect(lift).toBe(180);
  });

  it('never lifts further than clearing the whole sheet, even for a bogus input measurement', () => {
    // The focused input is inside the sheet, so clearing the sheet always clears the input.
    // A measurement claiming otherwise must not push the sheet off the top of the screen.
    const lift = computeKeyboardSheetLift({ ...baseInput, focusedInputBottom: 5000 });

    expect(lift).toBe(212);
  });

  it('returns a smaller lift when the keyboard shrinks', () => {
    // The lift is absolute, not a delta, so a second keyboard event with a shorter keyboard
    // lets the sheet back down instead of pushing it further up.
    const lift = computeKeyboardSheetLift({ ...baseInput, keyboardTop: 700 });

    expect(lift).toBe(128);
  });
});
