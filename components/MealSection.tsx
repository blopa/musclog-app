import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ReactNode } from 'react';
import { Button } from './theme/Button';
import { Plus } from 'lucide-react-native';

type MealSectionProps = {
  title: string;
  totalCalories: number;
  children: ReactNode;
  onAddFood?: () => void;
};

type AddFoodButtonProps = {
  mealName?: string;
  onPress?: () => void;
};

function AddFoodButton({ mealName, onPress }: AddFoodButtonProps) {
  const { t } = useTranslation();
  const buttonText = mealName
    ? t('food.meals.addFoodTo', { meal: mealName })
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

export function MealSection({ title, totalCalories, children, onAddFood }: MealSectionProps) {
  const { t } = useTranslation();

  return (
    <View>
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-text-primary">{title}</Text>
        <Text className="text-lg text-text-secondary">
          {totalCalories.toLocaleString('en-US', { useGrouping: false })} {t('food.common.kcal')}
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
