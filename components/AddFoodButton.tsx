import { Text, Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

type AddFoodButtonProps = {
  onPress?: () => void;
};

export function AddFoodButton({ onPress }: AddFoodButtonProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      className="w-full flex-row items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border-dashed py-4"
      onPress={onPress}>
      <Plus size={theme.iconSize.sm} color={theme.colors.text.secondary} />
      <Text className="font-medium text-text-secondary">{t('food.meals.addFood')}</Text>
    </Pressable>
  );
}
