import { Text, View } from 'react-native';

import WorkoutLogSet from '../database/models/WorkoutLogSet';
import { useTheme } from '../hooks/useTheme';

/**
 * Set data for display in workout history.
 * Extends WorkoutLogSet model fields with UI-specific properties.
 */
export type SetData = Pick<WorkoutLogSet, 'weight' | 'reps' | 'partials'> & {
  setNumber: number;
  isCurrent?: boolean;
};

type SetRowProps = {
  set: SetData;
  isLast: boolean;
  isPreview?: boolean;
};

export function SetRow({ set, isPreview = false }: SetRowProps) {
  const theme = useTheme();
  const isCurrent = set.isCurrent;

  return (
    <View
      className="flex-row items-center rounded py-1.5"
      style={{
        paddingVertical: theme.spacing.padding['1half'], // 6px
        borderRadius: theme.borderRadius.sm,
        backgroundColor: isCurrent ? theme.colors.accent.primary10 : 'transparent',
        borderWidth: isCurrent ? theme.borderWidth.thin : 0,
        borderColor: isCurrent ? theme.colors.accent.primary20 : 'transparent',
      }}
    >
      {/* Set Number */}
      <View className="w-8 items-center">
        <View
          className="h-5 w-5 items-center justify-center rounded-full"
          style={{
            backgroundColor: isCurrent
              ? theme.colors.accent.primary
              : theme.colors.background.overlay,
          }}
        >
          <Text
            className="text-xs font-bold"
            style={{
              color: isCurrent ? theme.colors.text.black : theme.colors.text.secondary,
            }}
          >
            {set.setNumber}
          </Text>
        </View>
      </View>

      {/* Weight */}
      <View className="flex-1 items-center">
        <Text
          className="text-base font-bold tabular-nums"
          style={{
            color: isCurrent ? theme.colors.text.primary : theme.colors.text.secondary,
          }}
        >
          {set.weight}
        </Text>
      </View>

      {/* Reps */}
      <View className="flex-1 items-center">
        <Text
          className="text-base font-bold tabular-nums"
          style={{
            color: isCurrent ? theme.colors.text.primary : theme.colors.text.secondary,
          }}
        >
          {set.reps}
        </Text>
      </View>

      {/* Partials */}
      {!isPreview ? (
        <View className="flex-1 items-center">
          <Text
            className="text-sm tabular-nums"
            style={{
              color:
                (set.partials ?? 0) > 0 ? theme.colors.accent.primary : theme.colors.text.tertiary,
              fontWeight:
                (set.partials ?? 0) > 0
                  ? theme.typography.fontWeight.bold
                  : theme.typography.fontWeight.normal,
            }}
          >
            {(set.partials ?? 0) > 0 ? `+${set.partials}` : '-'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
