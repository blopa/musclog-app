import { Text, Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

type AddFoodButtonProps = {
  mealName?: string;
  onPress?: () => void;
};

export function AddFoodButton({ mealName, onPress }: AddFoodButtonProps) {
  const { t } = useTranslation();
  const buttonText = mealName
    ? t('food.meals.addFoodTo', { meal: mealName })
    : t('food.meals.addFood');

  return (
    <Pressable
      className="w-full flex-row items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border-dashed py-4"
      onPress={onPress}>
      <Plus size={theme.iconSize.sm} color={theme.colors.text.secondary} />
      <Text className="font-medium text-text-secondary">{buttonText}</Text>
    </Pressable>
  );
}
