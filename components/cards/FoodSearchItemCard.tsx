import { type LucideIcon, Plus, UtensilsCrossed } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, ImageSourcePropType, Pressable, Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { type UnifiedFoodResult } from '@/hooks/useUnifiedFoodSearch';
import { addOpacityToHex } from '@/theme';
import { blurFilter } from '@/utils/blurFilter';

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
  intuitiveMode?: boolean;
};

export function FoodSearchItemCard({
  food,
  onAddPress,
  intuitiveMode = false,
}: FoodSearchItemCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatRoundedDecimal } = useFormatAppNumber();
  const macroLine = t('food.manageFoodLibrary.macrosFormat', {
    protein: intuitiveMode ? '0' : formatRoundedDecimal(food.protein ?? 0, 2),
    carbs: intuitiveMode ? '0' : formatRoundedDecimal(food.carbs ?? 0, 2),
    fat: intuitiveMode ? '0' : formatRoundedDecimal(food.fat ?? 0, 2),
  });

  return (
    <Pressable
      className="border-border-light bg-bg-overlay flex-row items-center gap-3 rounded-2xl border p-3 active:scale-[0.98]"
      onPress={onAddPress}
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
          <Text className="text-text-primary flex-1 truncate pr-2 font-semibold" numberOfLines={1}>
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
        <Text
          className="text-text-secondary truncate text-sm"
          numberOfLines={1}
          style={intuitiveMode ? blurFilter(4) : undefined}
        >
          {food.description}
        </Text>
        <Text
          className="text-text-secondary mt-0.5 text-xs"
          style={intuitiveMode ? blurFilter(4) : undefined}
        >
          {macroLine}
        </Text>
      </View>

      {/* Add Button */}
      <Pressable
        className="bg-bg-overlay active:bg-accent-primary h-8 w-8 items-center justify-center rounded-full"
        onPress={onAddPress}
        style={{
          backgroundColor: theme.colors.background.secondaryDark,
        }}
      >
        <Plus size={theme.iconSize.lg} color={theme.colors.accent.primary} />
      </Pressable>
    </Pressable>
  );
}
