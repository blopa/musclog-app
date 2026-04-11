import { type LucideIcon, Plus, UtensilsCrossed } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, ImageSourcePropType, Platform, Pressable, Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { type UnifiedFoodResult } from '@/hooks/useUnifiedFoodSearch';
import { addOpacityToHex } from '@/theme';

type FoodItem = UnifiedFoodResult & {
  icon?: string; // Emoji
  iconComponent?: LucideIcon; // Lucide icon component
  iconName?: string; // Lucide icon name, e.g. 'utensils-crossed'
  iconColor?: string;
  iconBgColor?: string;
  image?: ImageSourcePropType;
  grade?: string; // e.g., "A", "A+"
  gradeColor?: string;
};

type FoodSearchItemCardProps = {
  food: FoodItem;
  onAddPress: () => void;
};

export function FoodSearchItemCard({ food, onAddPress }: FoodSearchItemCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatRoundedDecimal } = useFormatAppNumber();
  const macroLine = t('food.manageFoodLibrary.macrosFormat', {
    protein: formatRoundedDecimal(food.protein ?? 0, 2),
    carbs: formatRoundedDecimal(food.carbs ?? 0, 2),
    fat: formatRoundedDecimal(food.fat ?? 0, 2),
  });

  const pressableProps =
    Platform.OS === 'android'
      ? { onPress: onAddPress, unstable_pressDelay: 130 as const }
      : { onPress: onAddPress };

  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-2xl border border-border-light bg-bg-overlay p-3 active:scale-[0.98]"
      {...pressableProps}
    >
      {/* Icon/Image */}
      <View
        className="h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
        style={{
          backgroundColor: food.iconBgColor || theme.colors.background.secondaryDark,
          borderColor: food.iconColor
            ? addOpacityToHex(food.iconColor, theme.colors.opacity.subtle)
            : 'transparent',
        }}
      >
        {food.image ? (
          <Image
            source={food.image}
            className="h-full w-full"
            resizeMode="cover"
            style={{ borderRadius: theme.borderRadius.xl }}
          />
        ) : food.imageUrl ? (
          <Image
            source={{ uri: food.imageUrl }}
            className="h-full w-full"
            resizeMode="cover"
            style={{ borderRadius: theme.borderRadius.xl }}
          />
        ) : food.iconComponent ? (
          (() => {
            const Icon = food.iconComponent;
            return (
              <Icon
                size={theme.iconSize.lg}
                color={food.iconColor ?? theme.colors.text.secondary}
              />
            );
          })()
        ) : food.iconName === 'utensils-crossed' ? (
          <UtensilsCrossed
            size={theme.iconSize.lg}
            color={food.iconColor ?? theme.colors.accent.primary}
          />
        ) : food.icon ? (
          <Text className="text-xl">{food.icon}</Text>
        ) : (
          <View className="h-full w-full opacity-80" />
        )}
      </View>

      {/* Content */}
      <View className="min-w-0 flex-1">
        <View className="flex-row items-start justify-between">
          <Text className="flex-1 truncate pr-2 font-semibold text-text-primary" numberOfLines={1}>
            {food.name}
          </Text>
          {food.grade ? (
            <View
              className="rounded border px-1.5 py-0.5"
              style={{
                backgroundColor: food.gradeColor
                  ? addOpacityToHex(food.gradeColor, theme.colors.opacity.veryLight)
                  : theme.colors.accent.primary5,
                borderColor: food.gradeColor
                  ? addOpacityToHex(food.gradeColor, theme.colors.opacity.subtle)
                  : theme.colors.accent.primary20,
              }}
            >
              <Text
                className="font-bold"
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: food.gradeColor || theme.colors.accent.primary,
                }}
              >
                {food.grade}
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="truncate text-sm text-text-secondary" numberOfLines={1}>
          {food.description}
        </Text>
        <Text className="mt-0.5 text-xs text-text-secondary">{macroLine}</Text>
      </View>

      {/* Add Button */}
      <Pressable
        className="h-8 w-8 items-center justify-center rounded-full bg-bg-overlay active:bg-accent-primary"
        {...pressableProps}
        style={{
          backgroundColor: theme.colors.background.secondaryDark,
        }}
      >
        <Plus size={theme.iconSize.lg} color={theme.colors.accent.primary} />
      </Pressable>
    </Pressable>
  );
}
