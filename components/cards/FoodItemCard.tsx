import { useTranslation } from 'react-i18next';
import { Image, ImageSourcePropType, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { MenuButton } from '../theme/MenuButton';
import { GenericCard } from './GenericCard';

type FoodItemCardProps = {
  name: string;
  description: string;
  calories: number;
  image: ImageSourcePropType;
  onMorePress?: () => void;
  protein?: number;
  carbs?: number;
  fat?: number;
};

export function FoodItemCard({
  name,
  description,
  calories,
  image,
  onMorePress,
  protein,
  carbs,
  fat,
}: FoodItemCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const p = Math.round(protein ?? 0);
  const c = Math.round(carbs ?? 0);
  const f = Math.round(fat ?? 0);
  const combinedDescription = `${description} • ${t('food.manageFoodLibrary.macrosFormat', { protein: p, carbs: c, fat: f })}`;

  return (
    <GenericCard variant="default">
      <View className="flex-row items-center gap-4 p-4">
        <View
          className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl"
          style={{ backgroundColor: theme.colors.background.gray700 }}
        >
          <Image source={image} className="h-full w-full" resizeMode="cover" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="mb-1 text-lg font-semibold text-text-primary">{name}</Text>
          <Text className="truncate text-sm text-text-secondary">{combinedDescription}</Text>
        </View>
        <View className="flex-shrink-0 items-end">
          <Text className="text-2xl font-bold text-accent-secondary">
            {calories.toLocaleString('en-US', { useGrouping: false })}
          </Text>
          <Text className="text-xs text-text-secondary">{t('food.common.kcal')}</Text>
        </View>
        <MenuButton size="sm" onPress={onMorePress} className="flex-shrink-0" />
      </View>
    </GenericCard>
  );
}
