import { Plus } from 'lucide-react-native';
import { memo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { theme } from '../theme';
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
};

type AddFoodButtonProps = {
  mealType?: string;
  onPress?: () => void;
};

function AddFoodButton({ mealType, onPress }: AddFoodButtonProps) {
  const { t } = useTranslation();
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
};

export const MealSectionHeader = memo(function MealSectionHeader({
  title,
  totalCalories,
  totalProtein = 0,
  totalCarbs = 0,
  totalFat = 0,
  menuButton,
}: MealSectionHeaderProps) {
  const { t, i18n } = useTranslation();

  return (
    <View className="items-flex-start mb-4 mt-4 flex-row justify-between">
      <Text className="text-2xl font-bold text-text-primary">{title}</Text>
      <View
        className="flex-row items-end gap-2"
        style={{
          ...(totalCalories > 0 && { marginTop: -theme.spacing.padding.base }),
        }}
      >
        <View className="items-end">
          <Text className="text-lg text-text-secondary">
            {totalCalories.toLocaleString(i18n.language, { useGrouping: false })}{' '}
            {t('food.common.kcal')}
          </Text>
          {totalProtein > 0 || totalCarbs > 0 || totalFat > 0 ? (
            <Text className="text-sm">
              <Text style={{ color: theme.colors.macros.protein.text }}>
                P: {Math.round(totalProtein)}g
              </Text>{' '}
              <Text className="text-text-secondary">•</Text>{' '}
              <Text style={{ color: theme.colors.macros.carbs.text }}>
                C: {Math.round(totalCarbs)}g
              </Text>{' '}
              <Text className="text-text-secondary">•</Text>{' '}
              <Text style={{ color: theme.colors.macros.fat.text }}>
                F: {Math.round(totalFat)}g
              </Text>
            </Text>
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
      />

      <View className="gap-3">
        {children}

        {/* Add Food Button */}
        <AddFoodButton mealType={title} onPress={onAddFood} />
      </View>
    </View>
  );
});
