import { Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { GenericCard } from './GenericCard';

type MacroCardProps = {
  name: string;
  percentage: number;
  amount: string;
  goal: number;
  color: string;
  progressColor: string;
  /** When true, uses smaller text so "amount / goal" fits in one line (used when any macro has large goal) */
  compact?: boolean;
  /** When true, forces vertical layout regardless of individual truncation detection */
  forceVertical?: boolean;
};

// Helper function to estimate if text will truncate
const willTruncate = (amount: string, goal: number, compact: boolean): boolean => {
  // Rough character limits based on testing
  const maxChars = compact ? 8 : 6;
  const totalChars = amount.length + goal.toString().length + 3; // +3 for " / g"
  return totalChars > maxChars;
};

export function MacroCard({
  name,
  percentage,
  amount,
  goal,
  color,
  progressColor,
  compact = false,
  forceVertical = false,
}: MacroCardProps) {
  const theme = useTheme();
  
  // Determine if we need to use vertical layout to prevent truncation
  const needsVerticalLayout = forceVertical || willTruncate(amount, goal, compact);

  return (
    <GenericCard variant="default" size="sm">
      <View className="p-4">
        <View className="mb-1 flex-row items-baseline gap-1">
          <Text className="text-sm text-text-secondary">{name}</Text>
          <Text className="text-sm font-semibold" style={{ color }}>
            {percentage}%
          </Text>
        </View>
        
        {/* Smart layout: horizontal if it fits, vertical if it would truncate */}
        {needsVerticalLayout ? (
          <View className="mb-3">
            <Text
              className={
                compact
                  ? 'text-xl font-bold text-text-primary'
                  : 'text-2xl font-bold text-text-primary'
              }
              numberOfLines={1}
              adjustsFontSizeToFit={false}
              style={{ textAlign: 'left' }}
            >
              {amount}
            </Text>
            <Text
              className={compact ? 'text-xs text-text-secondary' : 'text-sm text-text-secondary'}
              numberOfLines={1}
              style={{ textAlign: 'left' }}
            >
              / {goal}g
            </Text>
          </View>
        ) : (
          <View className="mb-3 flex-row items-center justify-between">
            <Text
              className={
                compact
                  ? 'text-xl font-bold text-text-primary'
                  : 'text-2xl font-bold text-text-primary'
              }
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ flex: 1, textAlign: 'left', marginRight: 4 }}
            >
              {amount}
            </Text>
            <Text
              className={compact ? 'text-xs text-text-secondary' : 'text-sm text-text-secondary'}
              numberOfLines={1}
              style={{ flexShrink: 0 }}
            >
              / {goal}g
            </Text>
          </View>
        )}
        <View
          className="h-1.5 overflow-hidden rounded-full"
          style={{ backgroundColor: theme.colors.background.gray800Opacity50 }}
        >
          <View
            className="h-full rounded-full"
            style={{ width: `${percentage}%`, backgroundColor: progressColor }}
          />
        </View>
      </View>
    </GenericCard>
  );
}
