import { Plus } from 'lucide-react-native';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from './theme/Button';

type MealSectionProps = {
  title: string;
  totalCalories: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  children: ReactNode;
  onAddFood?: () => void;
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
    <Button
      label={buttonText}
      icon={Plus}
      variant="dashed"
      size="md"
      width="full"
      onPress={onPress}
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
}: MealSectionProps) {
  const { t } = useTranslation();

  return (
    <View>
      <View className="mb-4 flex-col gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-text-primary">{title}</Text>
          <Text className="text-lg text-text-secondary">
            {totalCalories.toLocaleString('en-US', { useGrouping: false })} {t('food.common.kcal')}
          </Text>
        </View>
        {totalProtein > 0 || totalCarbs > 0 || totalFat > 0 ? (
          <View className="flex-row gap-4 text-sm text-text-secondary">
            <Text className="text-sm text-text-secondary">P: {Math.round(totalProtein)}g</Text>
            <Text className="text-sm text-text-secondary">C: {Math.round(totalCarbs)}g</Text>
            <Text className="text-sm text-text-secondary">F: {Math.round(totalFat)}g</Text>
          </View>
        ) : null}
      </View>

      <View className="gap-3">
        {children}

        {/* Add Food Button */}
        <AddFoodButton mealType={title} onPress={onAddFood} />
      </View>
    </View>
  );
}
