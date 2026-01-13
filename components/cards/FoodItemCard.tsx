import { View, Text, Image, Pressable, ImageSourcePropType } from 'react-native';
import { MoreVertical } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { GenericCard } from './GenericCard';

type FoodItemCardProps = {
  name: string;
  description: string;
  calories: number;
  image: ImageSourcePropType;
  onMorePress?: () => void;
};

export function FoodItemCard({
  name,
  description,
  calories,
  image,
  onMorePress,
}: FoodItemCardProps) {
  const { t } = useTranslation();

  return (
    <GenericCard variant="default">
      <View className="flex-row items-center gap-4 p-4">
        <View
          className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl"
          style={{ backgroundColor: theme.colors.background.gray700 }}>
          <Image source={image} className="h-full w-full" resizeMode="cover" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="mb-1 text-lg font-semibold text-text-primary">{name}</Text>
          <Text className="truncate text-sm text-text-secondary">{description}</Text>
        </View>
        <View className="flex-shrink-0 items-end">
          <Text className="text-2xl font-bold text-accent-secondary">{calories}</Text>
          <Text className="text-xs text-text-secondary">{t('food.common.kcal')}</Text>
        </View>
        <Pressable className="flex-shrink-0" onPress={onMorePress}>
          <MoreVertical size={theme.iconSize.sm} color={theme.colors.text.secondary} />
        </Pressable>
      </View>
    </GenericCard>
  );
}
