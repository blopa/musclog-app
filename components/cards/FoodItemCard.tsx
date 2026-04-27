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
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ImageSourcePropType, Text, useWindowDimensions, View } from 'react-native';

import { MenuButton } from '@/components/theme/MenuButton';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { blurFilter } from '@/utils/blurFilter';
import { getMassUnitLabel, gramsToDisplay } from '@/utils/unitConversion';

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
  intuitiveMode?: boolean;
};

const MacroItem = ({
  icon: Icon,
  value,
  label,
  unit,
  shortLabel,
  valueMode = 'decimal1',
  intuitiveMode = false,
}: {
  icon: any;
  value: number;
  label?: string;
  unit?: string;
  shortLabel?: string;
  /** `integer` = kcal-style; `decimal1` = grams/macros */
  valueMode?: 'integer' | 'decimal1';
  intuitiveMode?: boolean;
}) => {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { t } = useTranslation();
  const { formatInteger, formatRoundedDecimal } = useFormatAppNumber();

  const isNarrow = windowWidth < 380;
  const displayLabel = isNarrow && shortLabel ? shortLabel : label;
  const displayValue =
    valueMode === 'integer'
      ? formatInteger(Math.round(value), { useGrouping: false })
      : formatRoundedDecimal(value, 1);

  return (
    <View className="flex-row items-center gap-1">
      <Icon size={12} color={theme.colors.text.secondary} />
      <Text
        className="text-xs text-text-secondary"
        style={intuitiveMode ? blurFilter(4) : undefined}
      >
        {t('food.macroValueFormat', {
          value: intuitiveMode ? '0' : displayValue,
          unit: unit || '',
          label: displayLabel || '',
        })}
      </Text>
    </View>
  );
};

export const FoodItemCard = memo(function FoodItemCard({
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
  intuitiveMode = false,
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

  const p = protein ?? 0;
  const c = carbs ?? 0;
  const f = fat ?? 0;
  const g = gramsToDisplay(portion ?? 0, units);
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
          className={`flex-shrink-0 overflow-hidden rounded-xl ${
            variant === 'compact' ? 'h-12 w-12' : 'h-16 w-16'
          }`}
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
          <Text
            className="mb-1 text-lg font-semibold text-text-primary"
            numberOfLines={variant === 'compact' ? 1 : 2}
          >
            {name}
          </Text>
          {description && variant === 'default' ? (
            <Text className="mb-2 truncate text-sm text-text-secondary">{description}</Text>
          ) : null}
          <View className="flex-row items-center gap-3">
            <MacroItem icon={LucideScale} value={g} unit={massUnit} />
            <MacroItem
              icon={Flame}
              value={calories}
              label={t('food.common.kcal')}
              valueMode="integer"
              intuitiveMode={intuitiveMode}
            />
          </View>
          {variant === 'default' ? (
            <View className="flex-row items-center gap-3">
              <MacroItem
                icon={Zap}
                value={p}
                label={t('food.macros.protein')}
                shortLabel={t('food.macros.proteinShort')}
                unit={massUnit}
                intuitiveMode={intuitiveMode}
              />
              <MacroItem
                icon={Wheat}
                value={c}
                label={t('food.macros.carbs')}
                shortLabel={t('food.macros.carbsShort')}
                unit={massUnit}
                intuitiveMode={intuitiveMode}
              />
              <MacroItem
                icon={Droplet}
                value={f}
                label={t('food.macros.fat')}
                shortLabel={t('food.macros.fatShort')}
                unit={massUnit}
                intuitiveMode={intuitiveMode}
              />
            </View>
          ) : null}
        </View>
        {onMorePress ? (
          <MenuButton size="md" onPress={onMorePress} className="flex-shrink-0" />
        ) : null}
      </View>
    </GenericCard>
  );
});
