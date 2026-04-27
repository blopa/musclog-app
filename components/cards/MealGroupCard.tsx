import {
  Apple,
  Coffee,
  Droplet,
  EggFried,
  Flame,
  Soup,
  UtensilsCrossed,
  Wheat,
  Zap,
} from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { MenuButton } from '@/components/theme/MenuButton';
import { type MealType } from '@/database/models';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { blurFilter } from '@/utils/blurFilter';

import { GenericCard } from './GenericCard';

type MealGroupCardProps = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType: MealType;
  onMorePress?: () => void;
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
  valueMode?: 'integer' | 'decimal1';
  intuitiveMode?: boolean;
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger, formatRoundedDecimal } = useFormatAppNumber();

  const displayValue =
    valueMode === 'integer'
      ? formatInteger(Math.round(value), { useGrouping: false })
      : formatRoundedDecimal(value, 1);

  return (
    <View className="flex-row items-center gap-1">
      <Icon size={12} color={theme.colors.text.secondary} />
      <Text
        className="text-text-secondary text-xs"
        style={intuitiveMode ? blurFilter(4) : undefined}
      >
        {t('food.macroValueFormat', {
          value: intuitiveMode ? '0' : displayValue,
          unit: unit || '',
          label: label || shortLabel || '',
        })}
      </Text>
    </View>
  );
};

const getMealIconAndColor = (
  mealType: MealType,
  theme: ReturnType<typeof useTheme>
): { Icon: typeof UtensilsCrossed; bgColor: string; iconColor: string } => {
  switch (mealType) {
    case 'breakfast':
      return {
        Icon: EggFried,
        bgColor: theme.colors.status.warning10,
        iconColor: theme.colors.status.warning,
      };
    case 'lunch':
      return {
        Icon: Soup,
        bgColor: theme.colors.status.emerald10,
        iconColor: theme.colors.status.emerald,
      };
    case 'dinner':
      return {
        Icon: UtensilsCrossed,
        bgColor: theme.colors.status.indigo10,
        iconColor: theme.colors.status.indigo,
      };
    case 'snack':
      return {
        Icon: Apple,
        bgColor: theme.colors.status.yellow10,
        iconColor: theme.colors.status.yellow,
      };
    case 'other':
      return {
        Icon: Coffee,
        bgColor: theme.colors.status.gray10,
        iconColor: theme.colors.text.secondary,
      };
    default:
      return {
        Icon: UtensilsCrossed,
        bgColor: theme.colors.status.indigo10,
        iconColor: theme.colors.status.indigo,
      };
  }
};

export const MealGroupCard = memo(function MealGroupCard({
  name,
  calories,
  protein,
  carbs,
  fat,
  mealType,
  onMorePress,
  intuitiveMode = false,
}: MealGroupCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const { Icon, bgColor, iconColor } = getMealIconAndColor(mealType, theme);

  return (
    <GenericCard variant="default">
      <View className="flex-row items-center gap-4 p-4">
        {/* Meal icon with colour-coded background */}
        <View
          className="h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl"
          style={{ backgroundColor: bgColor }}
        >
          <Icon size={theme.iconSize.lg} color={iconColor} />
        </View>

        <View className="min-w-0 flex-1">
          {/* Meal name + badge */}
          <View className="mb-1 flex-row items-center gap-2">
            <Text className="text-text-primary flex-1 text-lg font-semibold" numberOfLines={2}>
              {name}
            </Text>
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: theme.colors.status.indigo10 }}
            >
              <Text className="text-xs font-semibold" style={{ color: theme.colors.status.indigo }}>
                {t('food.mealGroup.badge')}
              </Text>
            </View>
          </View>

          {/* Calories row */}
          <View className="mb-0.5 flex-row items-center gap-3">
            <MacroItem
              icon={Flame}
              value={calories}
              label={t('food.common.kcal')}
              valueMode="integer"
              intuitiveMode={intuitiveMode}
            />
          </View>

          {/* Macros row */}
          <View className="flex-row items-center gap-3">
            <MacroItem
              icon={Zap}
              value={protein}
              label={t('food.macros.protein')}
              shortLabel={t('food.macros.proteinShort')}
              unit="g"
              intuitiveMode={intuitiveMode}
            />
            <MacroItem
              icon={Wheat}
              value={carbs}
              label={t('food.macros.carbs')}
              shortLabel={t('food.macros.carbsShort')}
              unit="g"
              intuitiveMode={intuitiveMode}
            />
            <MacroItem
              icon={Droplet}
              value={fat}
              label={t('food.macros.fat')}
              shortLabel={t('food.macros.fatShort')}
              unit="g"
              intuitiveMode={intuitiveMode}
            />
          </View>
        </View>

        {onMorePress ? (
          <MenuButton size="md" onPress={onMorePress} className="flex-shrink-0" />
        ) : null}
      </View>
    </GenericCard>
  );
});
