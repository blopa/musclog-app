import {
  Apple,
  Coffee,
  Droplet,
  EggFried,
  Flame,
  LucideScale,
  Soup,
  UtensilsCrossed,
  Wheat,
  Zap,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ImageSourcePropType, Text, View } from 'react-native';

import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import { getMassUnitLabel, gramsToDisplay } from '../../utils/unitConversion';
import { MenuButton } from '../theme/MenuButton';
import { GenericCard } from './GenericCard';

type FoodItemCardProps = {
  name: string;
  description?: string;
  calories: number;
  image?: ImageSourcePropType;
  onMorePress?: () => void;
  protein?: number;
  carbs?: number;
  fat?: number;
  portion?: number;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
  variant?: 'default' | 'compact';
};

const MacroItem = ({
  icon: Icon,
  value,
  label,
  unit,
}: {
  icon: any;
  value: number;
  label?: string;
  unit?: string;
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View className="flex-row items-center gap-1">
      <Icon size={12} color={theme.colors.text.secondary} />
      <Text className="text-xs text-text-secondary">
        {t('food.macroValueFormat', {
          value,
          unit: unit || '',
          label: label || '',
        })}
      </Text>
    </View>
  );
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
  mealType,
  portion,
  variant = 'default',
}: FoodItemCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units } = useSettings();
  const [imageError, setImageError] = useState(false);

  // Helper function to get the appropriate icon based on meal type
  const getMealIcon = () => {
    switch (mealType) {
      case 'breakfast':
        return EggFried;
      case 'lunch':
        return Soup;
      case 'dinner':
        return UtensilsCrossed;
      case 'snack':
        return Apple;
      case 'other':
        return Coffee;
      default:
        return UtensilsCrossed;
    }
  };

  const MealIcon = getMealIcon();

  const p = Math.round(protein ?? 0);
  const c = Math.round(carbs ?? 0);
  const f = Math.round(fat ?? 0);
  const g = Math.round(gramsToDisplay(portion ?? 0, units));
  const massUnit = getMassUnitLabel(units);

  const handleImageError = () => {
    setImageError(true);
  };

  // Reset image error state when image prop changes
  useEffect(() => {
    if (image) {
      setImageError(false);
    }
  }, [image]);

  return (
    <GenericCard variant="default">
      <View className="flex-row items-center gap-4 p-4">
        <View
          className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl"
          style={{ backgroundColor: theme.colors.background.gray700 }}
        >
          {!image || imageError ? (
            <View className="flex-1 items-center justify-center">
              <MealIcon size={theme.iconSize.lg} color={theme.colors.text.secondary} />
            </View>
          ) : (
            <Image
              source={image}
              className="h-full w-full"
              resizeMode="cover"
              onError={handleImageError}
            />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="mb-1 text-lg font-semibold text-text-primary" numberOfLines={2}>
            {name}
          </Text>
          {description ? (
            <Text className="mb-2 truncate text-sm text-text-secondary">{description}</Text>
          ) : null}
          <View className="flex-row items-center gap-3">
            <MacroItem icon={LucideScale} value={g} unit={massUnit} />
            <MacroItem icon={Flame} value={calories} label={t('food.common.kcal')} />
          </View>
          <View className="flex-row items-center gap-3">
            <MacroItem icon={Zap} value={p} label={t('food.macros.protein')} unit={massUnit} />
            <MacroItem icon={Wheat} value={c} label={t('food.macros.carbs')} unit={massUnit} />
            <MacroItem icon={Droplet} value={f} label={t('food.macros.fat')} unit={massUnit} />
          </View>
        </View>
        <MenuButton size="md" onPress={onMorePress} className="flex-shrink-0" />
      </View>
    </GenericCard>
  );
}
