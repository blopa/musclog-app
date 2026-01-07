import { Text, Pressable } from 'react-native';
import { ListPlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

type MoreFoodOptionsButtonProps = {
  onPress?: () => void;
};

export function MoreFoodOptionsButton({ onPress }: MoreFoodOptionsButtonProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      className="flex-row items-center justify-center gap-3 rounded-2xl border border-border-default bg-bg-overlay px-6 py-4"
      onPress={onPress}>
      <ListPlus size={theme.iconSize.md} color={theme.colors.accent.primary} />
      <Text className="text-lg font-semibold text-text-primary">
        {t('food.actions.moreFoodOptions')}
      </Text>
    </Pressable>
  );
}
