import { Text, View } from 'react-native';

import WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { useTheme } from '@/hooks/useTheme';

/**
 * Set data for display in workout history.
 * Extends WorkoutLogSet model fields with UI-specific properties.
 */
export type SetData = Pick<WorkoutLogSet, 'weight' | 'reps' | 'partials'> & {
  setNumber: number;
  isCurrent?: boolean;
  isSkipped?: boolean;
};

type SetRowProps = {
  set: SetData;
  isLast: boolean;
  isPreview?: boolean;
  weightUnitSuffix?: string;
};

export function SetRow({ set, isPreview = false, weightUnitSuffix }: SetRowProps) {
  const theme = useTheme();
  const isCurrent = set.isCurrent;
  const isSkipped = set.isSkipped ?? false;
  const isHighlighted = isCurrent && !isSkipped;
  const setNumberColor = isHighlighted ? theme.colors.text.black : theme.colors.text.secondary;
  const textDecoration = isSkipped ? ('line-through' as const) : ('none' as const);
  let valueColor = theme.colors.text.secondary;
  if (isSkipped) {
    valueColor = theme.colors.text.tertiary;
  } else if (isHighlighted) {
    valueColor = theme.colors.text.primary;
  }

  const hasPartials = (set.partials ?? 0) > 0;
  let partialColor = theme.colors.text.tertiary;
  if (isSkipped) {
    partialColor = theme.colors.text.tertiary;
  } else if (hasPartials) {
    partialColor = theme.colors.accent.primary;
  }

  return (
    <View
      className="flex-row items-center rounded py-1.5"
      style={{
        paddingVertical: theme.spacing.padding['1half'], // 6px
        borderRadius: theme.borderRadius.sm,
        backgroundColor: isHighlighted ? theme.colors.accent.primary10 : 'transparent',
        borderWidth: isHighlighted ? theme.borderWidth.thin : 0,
        borderColor: isHighlighted ? theme.colors.accent.primary20 : 'transparent',
        opacity: isSkipped ? 0.7 : 1,
      }}
    >
      {/* Set Number */}
      <View className="w-8 items-center">
        <View
          className="h-5 w-5 items-center justify-center rounded-full"
          style={{
            backgroundColor: isHighlighted
              ? theme.colors.accent.primary
              : theme.colors.background.overlay,
          }}
        >
          <Text
            className="text-xs font-bold"
            style={{
              color: setNumberColor,
              textDecorationLine: textDecoration,
            }}
          >
            {set.setNumber}
          </Text>
        </View>
      </View>

      {/* Weight */}
      <View className="flex-1 items-center">
        <Text className="text-base font-bold tabular-nums" style={{ color: valueColor, textDecorationLine: textDecoration }}>
          {set.weight}
          {weightUnitSuffix ?? ''}
        </Text>
      </View>

      {/* Reps */}
      <View className="flex-1 items-center">
        <Text className="text-base font-bold tabular-nums" style={{ color: valueColor, textDecorationLine: textDecoration }}>
          {set.reps}
        </Text>
      </View>

      {/* Partials */}
      {!isPreview ? (
        <View className="flex-1 items-center">
          <Text
            className="text-sm tabular-nums"
            style={{
              color: partialColor,
              fontWeight:
                !isSkipped && (set.partials ?? 0) > 0
                  ? theme.typography.fontWeight.bold
                  : theme.typography.fontWeight.normal,
              textDecorationLine: textDecoration,
            }}
          >
            {(set.partials ?? 0) > 0 ? `+${set.partials}` : '-'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
