import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';

const INDIGO = '#6366f1';

type ChatMealCardProps = {
  mealName: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  wasTracked?: boolean;
  onViewDetails?: () => void;
};

export function ChatMealCard({
  mealName,
  calories,
  protein,
  carbs,
  fats,
  wasTracked = false,
  onViewDetails,
}: ChatMealCardProps) {
  const theme = useTheme();

  return (
    <View
      className="overflow-hidden rounded-2xl rounded-bl-sm"
      style={{
        backgroundColor: theme.colors.background.card,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.border.light,
        minWidth: 240,
      }}
    >
      {/* Header */}
      <View className="flex-row items-baseline justify-between px-4 pb-2 pt-4">
        <Text
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: theme.colors.text.tertiary }}
        >
          {mealName}
        </Text>
        <View className="flex-row items-center gap-2">
          {wasTracked ? (
            <View
              className="flex-row items-center gap-1 rounded-full px-2 py-0.5"
              style={{ backgroundColor: theme.colors.accent.primary20 }}
            >
              <Check size={10} color={theme.colors.accent.primary} />
              <Text
                className="text-[10px] font-bold"
                style={{ color: theme.colors.accent.primary }}
              >
                Tracked
              </Text>
            </View>
          ) : null}
          <View className="flex-row items-baseline gap-1">
            <Text className="text-2xl font-bold text-text-primary">{calories}</Text>
            <Text className="text-sm font-medium" style={{ color: theme.colors.text.tertiary }}>
              kcal
            </Text>
          </View>
        </View>
      </View>

      {/* Macros Row */}
      <View
        className="mx-4 mb-4 flex-row items-center justify-between rounded-lg p-3"
        style={{ backgroundColor: theme.colors.background.primary }}
      >
        <View className="flex-1 items-center">
          <Text
            className="text-[10px] font-bold uppercase"
            style={{ color: theme.colors.text.tertiary }}
          >
            Protein
          </Text>
          <Text className="mt-0.5 text-sm font-bold" style={{ color: theme.colors.accent.primary }}>
            P: {protein}g
          </Text>
        </View>

        <View className="h-6 w-px" style={{ backgroundColor: theme.colors.border.light }} />

        <View className="flex-1 items-center">
          <Text
            className="text-[10px] font-bold uppercase"
            style={{ color: theme.colors.text.tertiary }}
          >
            Carbs
          </Text>
          <Text className="mt-0.5 text-sm font-bold" style={{ color: INDIGO }}>
            C: {carbs}g
          </Text>
        </View>

        <View className="h-6 w-px" style={{ backgroundColor: theme.colors.border.light }} />

        <View className="flex-1 items-center">
          <Text
            className="text-[10px] font-bold uppercase"
            style={{ color: theme.colors.text.tertiary }}
          >
            Fats
          </Text>
          <Text className="mt-0.5 text-sm font-bold" style={{ color: theme.colors.status.warning }}>
            F: {fats}g
          </Text>
        </View>
      </View>

      {/* View Details / Already Tracked Button */}
      {onViewDetails ? (
        <View className="px-4 pb-4">
          <Pressable
            onPress={wasTracked ? undefined : onViewDetails}
            disabled={wasTracked}
            className="w-full items-center rounded-lg py-1.5"
            style={{
              borderWidth: theme.borderWidth.thin,
              borderColor: wasTracked
                ? theme.colors.border.light
                : `${theme.colors.accent.primary}33`,
              opacity: wasTracked ? 0.6 : 1,
            }}
          >
            <Text
              className="text-sm font-bold"
              style={{
                color: wasTracked ? theme.colors.text.tertiary : theme.colors.accent.primary,
              }}
            >
              {wasTracked ? 'Already Tracked' : 'View Full Details'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
