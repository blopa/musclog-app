import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type TargetFieldHeaderProps = {
  label: string;
  /** Marks a field the current goal mode cannot do without. */
  required?: boolean;
  /** The text button at the end of the row. Left out (`null`), the row offers nothing. */
  action: { label: string; onPress: () => void } | null;
};

/**
 * The row above an optional target field (weight, body fat, BMI, FFMI): its name, and a text
 * button that sets the target or clears it. Both halves shrink and wrap instead of overlapping, so
 * a long translation or large text never pushes the button off the card.
 */
export function TargetFieldHeader({ label, required = false, action }: TargetFieldHeaderProps) {
  const theme = useTheme();

  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="shrink text-sm font-medium text-text-secondary">
        {label}
        {required ? <Text style={{ color: theme.colors.status.error }}> *</Text> : null}
      </Text>
      {action ? (
        <Pressable onPress={action.onPress} className="shrink active:opacity-70">
          <Text
            className="text-right text-sm font-medium"
            style={{ color: theme.colors.text.tertiary }}
          >
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
