import { View, Text, Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ReactNode } from 'react';
import { theme } from '../theme';

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
        <Pressable
          className="w-full flex-row items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border-dashed py-4"
          onPress={onAddFood}>
          <Plus size={theme.iconSize.sm} color={theme.colors.text.secondary} />
          <Text className="font-medium text-text-secondary">{t('food.meals.addFood')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
