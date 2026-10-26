import { Plus } from 'lucide-react-native';
import { memo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { blurFilter } from '@/utils/blurFilter';

import DashedButton from './theme/DashedButton';
import { TextButton } from './theme/TextButton';

type MealSectionProps = {
  title: string;
  totalCalories: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  children: ReactNode;
  onAddFood?: () => void;
  menuButton?: ReactNode;
  intuitiveMode?: boolean;
  /** Whether the meal has anything logged. Only an empty meal is drawn as a dashed slot. */
  hasItems?: boolean;
};

type AddFoodButtonProps = {
  mealType?: string;
  onPress?: () => void;
  hasItems?: boolean;
};

/**
 * A dashed outline means "this slot is empty, fill it". Under a meal that already has food the
 * same action is a plain text button, so a full diary is not striped with dashed bars.
 */
function AddFoodButton({ mealType, onPress, hasItems = false }: AddFoodButtonProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const buttonText = mealType
    ? t('food.meals.addFoodTo', { meal: mealType })
    : t('food.meals.addFood');

  if (hasItems) {
    return <TextButton label={buttonText} icon={Plus} onPress={onPress} />;
  }

  return (
    <DashedButton
      label={buttonText}
      onPress={onPress}
      size="sm"
      icon={<Plus size={theme.iconSize.md} color={theme.colors.text.secondary} />}
    />
  );
}

export type MealSectionHeaderProps = {
  title: string;
  totalCalories: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  menuButton?: ReactNode;
  intuitiveMode?: boolean;
};

export const MealSectionHeader = memo(function MealSectionHeader({
  title,
  totalCalories,
  totalProtein = 0,
  totalCarbs = 0,
  totalFat = 0,
  menuButton,
  intuitiveMode = false,
}: MealSectionHeaderProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();

  return (
    <View className="mb-2 mt-5 flex-row items-center justify-between gap-3">
      <Text className="shrink text-lg font-semibold text-text-primary">{title}</Text>
      <View className="flex-row items-center gap-1">
        <View className="items-end">
          <Text
            className="text-sm font-semibold tabular-nums text-text-primary"
            style={intuitiveMode ? blurFilter(5) : undefined}
          >
            {intuitiveMode
              ? `0 ${t('food.common.kcal')}`
              : `${formatInteger(Math.round(totalCalories), { useGrouping: false })} ${t('food.common.kcal')}`}
          </Text>
          {totalProtein > 0 || totalCarbs > 0 || totalFat > 0 ? (
            <View
              className="flex-row items-center"
              style={intuitiveMode ? blurFilter(4) : undefined}
            >
              <Text
                className="text-xs tabular-nums"
                style={{ color: theme.colors.macros.protein.text }}
              >
                {t('common.labelColonValue', {
                  label: t('food.macros.proteinShort'),
                  value: t('common.weightFormatG', {
                    value: intuitiveMode ? 0 : formatInteger(Math.round(totalProtein)),
                  }),
                })}
              </Text>
              <Text className="text-xs text-text-tertiary">{' · '}</Text>
              <Text
                className="text-xs tabular-nums"
                style={{ color: theme.colors.macros.carbs.text }}
              >
                {t('common.labelColonValue', {
                  label: t('food.macros.carbsShort'),
                  value: t('common.weightFormatG', {
                    value: intuitiveMode ? 0 : formatInteger(Math.round(totalCarbs)),
                  }),
                })}
              </Text>
              <Text className="text-xs text-text-tertiary">{' · '}</Text>
              <Text
                className="text-xs tabular-nums"
                style={{ color: theme.colors.macros.fat.text }}
              >
                {t('common.labelColonValue', {
                  label: t('food.macros.fatShort'),
                  value: t('common.weightFormatG', {
                    value: intuitiveMode ? 0 : formatInteger(Math.round(totalFat)),
                  }),
                })}
              </Text>
            </View>
          ) : null}
        </View>
        {menuButton}
      </View>
    </View>
  );
});

export const MealSection = memo(function MealSection({
  title,
  totalCalories,
  totalProtein = 0,
  totalCarbs = 0,
  totalFat = 0,
  children,
  onAddFood,
  menuButton,
  intuitiveMode = false,
  hasItems = false,
}: MealSectionProps) {
  return (
    <View>
      <MealSectionHeader
        title={title}
        totalCalories={totalCalories}
        totalProtein={totalProtein}
        totalCarbs={totalCarbs}
        totalFat={totalFat}
        menuButton={menuButton}
        intuitiveMode={intuitiveMode}
      />

      <View className="gap-3">
        {children}

        {/* Add Food Button */}
        <AddFoodButton mealType={title} onPress={onAddFood} hasItems={hasItems} />
      </View>
    </View>
  );
});
