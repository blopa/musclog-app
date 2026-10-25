import { useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';
import { Platform, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/**
 * - `hero`: the Guided view's big number, on its card with no surface of its own.
 * - `field`: a standalone value in a form or sheet (effort, partial reps).
 * - `cell`: one cell of a table row, `width` wide (the Inline set table).
 */
export type NumericTextFieldSize = 'hero' | 'field' | 'cell';

type NumericTextFieldProps = {
  /** The text as typed, in the user's locale. Empty means "no value", not zero. */
  value: string;
  onChangeText: (text: string) => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  size?: NumericTextFieldSize;
  /** Required for `cell`; the others fill their container. */
  width?: number;
  /** Whole numbers only: a number pad without a decimal key. */
  integer?: boolean;
  /** Shown while the field is empty and not being edited. */
  placeholder?: string;
  /**
   * The app calculated this value and the user has not typed over it: accent ink and an
   * underline, so it reads without color too.
   */
  marked?: boolean;
  /**
   * The value cannot be saved as typed (an emptied weight, zero reps): an error-coloured outline,
   * so the field to fix is visible next to the message that names it.
   */
  invalid?: boolean;
  /** Draw the field's own surface. Defaults to on for `field` and `cell`, off for `hero`. */
  surface?: boolean;
  editable?: boolean;
  testID?: string;
};

/**
 * A centered, string-valued numeric input. It holds the user's text verbatim — the caller parses
 * it with the locale helpers — so an empty field can mean "not rated" instead of collapsing to 0,
 * which is what the number-valued steppers (`StepperInput`) would do.
 *
 * The placeholder is drawn by this component, never handed to the native input: on Android a
 * centered `TextInput` with a native placeholder put the caret at the far edge of an empty field
 * on first focus, and only moved it to the middle once a digit was typed. It is also hidden while
 * the field is focused, so an empty focused field shows only the caret.
 */
export function NumericTextField({
  value,
  onChangeText,
  accessibilityLabel,
  accessibilityHint,
  size = 'field',
  width,
  integer = false,
  placeholder,
  marked = false,
  invalid = false,
  surface = size !== 'hero',
  editable = true,
  testID,
}: NumericTextFieldProps) {
  const theme = useTheme();
  const inputRef = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);

  const metrics = {
    hero: { fontSize: theme.typography.fontSize['5xl'], minHeight: 64 },
    field: { fontSize: theme.typography.fontSize.xl, minHeight: 56 },
    cell: { fontSize: theme.typography.fontSize.lg, minHeight: 44 },
  }[size];
  const showPlaceholder = placeholder != null && value === '' && !focused;

  // A field with a surface is outlined like every other input (`TextInput`, `PickerButton`): a
  // fill alone vanished wherever it matched what was behind it. A `field` sat on a sheet painted in
  // `cardElevated` — its own fill — so the set-details effort fields read as loose labels. It
  // takes `TextInput`'s `card` fill instead; a `cell` keeps `cardElevated`, the contrasting fill on
  // the `card` the set table lives on.
  let borderColor = surface ? theme.colors.background.ink10 : 'transparent';
  if (invalid) {
    borderColor = theme.colors.status.error;
  } else if (focused && surface) {
    borderColor = theme.colors.accent.primary;
  }

  let fill = 'transparent';
  if (surface) {
    fill = size === 'field' ? theme.colors.background.card : theme.colors.background.cardElevated;
  }

  return (
    <View
      style={{
        width: width ?? '100%',
        minHeight: metrics.minHeight,
        justifyContent: 'center',
        borderRadius: theme.borderRadius.md,
        backgroundColor: fill,
        // A constant width, so focusing or marking a field never shifts its neighbours.
        borderWidth: theme.borderWidth.medium,
        borderColor,
        // Marked reads by the underline as well as the accent ink, so it survives without color.
        borderBottomColor: marked && !invalid ? theme.colors.accent.primary : borderColor,
      }}
    >
      <TextInput
        ref={inputRef}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        testID={testID}
        value={value}
        editable={editable}
        onChangeText={onChangeText}
        keyboardType={integer ? 'number-pad' : 'decimal-pad'}
        inputMode={integer ? 'numeric' : 'decimal'}
        // Android's native select-on-focus is unreliable; select explicitly instead, as the theme
        // `TextInput` does.
        selectTextOnFocus={Platform.OS === 'ios'}
        onFocus={() => {
          setFocused(true);
          if (Platform.OS === 'android' && value) {
            inputRef.current?.setSelection(0, value.length);
          }
        }}
        onBlur={() => setFocused(false)}
        style={{
          minHeight: metrics.minHeight,
          padding: 0,
          color: marked ? theme.colors.accent.primary : theme.colors.text.primary,
          fontSize: metrics.fontSize,
          fontWeight: theme.typography.fontWeight.bold,
          textAlign: 'center',
        }}
      />
      {showPlaceholder ? (
        <View
          pointerEvents="none"
          className="absolute inset-0 items-center justify-center"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text
            style={{
              color: theme.colors.text.tertiary,
              fontSize: metrics.fontSize,
              fontWeight: theme.typography.fontWeight.bold,
            }}
          >
            {placeholder}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
