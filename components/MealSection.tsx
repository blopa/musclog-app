import { Plus } from 'lucide-react-native';
import { memo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { blurFilter } from '@/utils/blurFilter';

import DashedButton from './theme/DashedButton';

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
};

type AddFoodButtonProps = {
  mealType?: string;
  onPress?: () => void;
};

function AddFoodButton({ mealType, onPress }: AddFoodButtonProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const buttonText = mealType
    ? t('food.meals.addFoodTo', { meal: mealType })
    : t('food.meals.addFood');

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
    <View className="items-flex-start mt-4 mb-4 flex-row justify-between">
      <Text className="text-text-primary text-2xl font-bold">{title}</Text>
      <View
        className="flex-row items-end gap-2"
        style={{
          ...(totalCalories > 0 && { marginTop: -theme.spacing.padding.base }),
        }}
      >
        <View className="items-end">
          <Text
            className="text-text-secondary text-lg"
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
              <Text className="text-sm" style={{ color: theme.colors.macros.protein.text }}>
                {t('common.labelColonValue', {
                  label: t('food.macros.proteinShort'),
                  value: t('common.weightFormatG', {
                    value: intuitiveMode ? 0 : formatInteger(Math.round(totalProtein)),
                  }),
                })}
              </Text>
              <Text className="text-text-secondary text-sm">{' • '}</Text>
              <Text className="text-sm" style={{ color: theme.colors.macros.carbs.text }}>
                {t('common.labelColonValue', {
                  label: t('food.macros.carbsShort'),
                  value: t('common.weightFormatG', {
                    value: intuitiveMode ? 0 : formatInteger(Math.round(totalCarbs)),
                  }),
                })}
              </Text>
              <Text className="text-text-secondary text-sm">{' • '}</Text>
              <Text className="text-sm" style={{ color: theme.colors.macros.fat.text }}>
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

export type MealSectionFooterProps = {
  title: string;
  onAddFood?: () => void;
};

export const MealSectionFooter = memo(function MealSectionFooter({
  title,
  onAddFood,
}: MealSectionFooterProps) {
  return (
    <View className="pb-6">
      <AddFoodButton mealType={title} onPress={onAddFood} />
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
        <AddFoodButton mealType={title} onPress={onAddFood} />
      </View>
    </View>
  );
});
