import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ReactNode } from 'react';
import { AddFoodButton } from './AddFoodButton';

type MealSectionProps = {
  title: string;
  totalCalories: number;
  children: ReactNode;
  onAddFood?: () => void;
};

export function MealSection({ title, totalCalories, children, onAddFood }: MealSectionProps) {
  const { t } = useTranslation();

  return (
    <View>
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-text-primary">{title}</Text>
        <Text className="text-lg text-text-secondary">
          {totalCalories} {t('food.common.kcal')}
        </Text>
      </View>

      <View className="gap-3">
        {children}

        {/* Add Food Button */}
        <AddFoodButton mealName={title} onPress={onAddFood} />
      </View>
    </View>
  );
}
