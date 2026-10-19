import { Trophy } from 'lucide-react-native';
import { View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/**
 * The finished-workout mark. It used to float up and down with three pulsing stars around it on
 * infinite JS-thread loops; the confetti already celebrates the milestones that earn it.
 */
export function WorkoutSummaryTrophy() {
  const theme = useTheme();

  return (
    <View
      className="mb-8 h-32 w-32 items-center justify-center rounded-full border"
      style={{
        backgroundColor: theme.colors.accent.primary10,
        borderColor: theme.colors.background.ink5,
      }}
    >
      <Trophy
        size={theme.size['16']}
        color={theme.colors.accent.primary}
        strokeWidth={theme.strokeWidth.medium}
      />
    </View>
  );
}
