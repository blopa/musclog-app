import { Plus } from 'lucide-react-native';
import { ReactNode } from 'react';
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

export function MealSection({
  title,
  totalCalories,
  totalProtein = 0,
  totalCarbs = 0,
  totalFat = 0,
  children,
  onAddFood,
  menuButton,
}: MealSectionProps) {
  const { t } = useTranslation();

  return (
    <View>
      <View className="items-flex-start mb-4 mt-4 flex-row justify-between">
        <Text className="text-2xl font-bold text-text-primary">{title}</Text>
        <View
          className="items-end flex-row gap-2"
          style={{
            ...(totalCalories > 0 && { marginTop: -theme.spacing.padding.base }),
          }}
        >
          <View className="items-end">
            <Text className="text-lg text-text-secondary">
              {totalCalories.toLocaleString('en-US', { useGrouping: false })} {t('food.common.kcal')}
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

      <View className="gap-3">
        {children}

        {/* Add Food Button */}
        <AddFoodButton mealType={title} onPress={onAddFood} />
      </View>
    </View>
  );
}
