import { View, Text, Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ReactNode } from 'react';

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
        <Text className="text-2xl font-bold text-white">{title}</Text>
        <Text className="text-lg text-gray-400">
          {totalCalories} {t('food.common.kcal')}
        </Text>
      </View>

      <View className="gap-3">
        {children}

        {/* Add Food Button */}
        <Pressable
          className="w-full flex-row items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-700 py-4"
          onPress={onAddFood}>
          <Plus size={20} color="#9ca3af" />
          <Text className="font-medium text-gray-400">{t('food.meals.addFood')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
