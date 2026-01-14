import { View, Text, Image, ImageSourcePropType } from 'react-native';
import { Flame } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { CircularArrow } from '../CircularArrow';
import { GenericCard } from './GenericCard';

type RecentWorkoutsCardProps = {
  name: string;
  date: string;
  duration: string;
  calories: number;
  prs: number | null;
  image: ImageSourcePropType;
  imageBgColor: string;
  onPress?: () => void;
};

export function RecentWorkoutsCard({
  name,
  date,
  duration,
  calories,
  prs,
  image,
  imageBgColor,
  onPress,
}: RecentWorkoutsCardProps) {
  const { t } = useTranslation();
  return (
    <GenericCard variant="default" size="sm" isPressable={true} onPress={onPress}>
      <View className="flex-row items-center gap-4 p-4">
        <View
          className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl"
          style={{ backgroundColor: imageBgColor }}>
          <Image source={image} className="h-full w-full" resizeMode="cover" />
        </View>
        <View className="flex-1">
          <Text className="mb-1 text-lg font-bold text-text-primary">{name}</Text>
          <Text className="mb-2 text-sm text-text-secondary">
            {date} • {duration}
          </Text>
          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center gap-1 rounded-full bg-bg-secondary px-2.5 py-1">
              <Flame size={theme.iconSize.xs} color={theme.colors.status.warning} />
              <Text className="text-xs font-medium" style={{ color: theme.colors.status.warning }}>
                {calories}
              </Text>
            </View>
            {prs !== null && (
              <View className="flex-row items-center gap-1 rounded-full bg-bg-secondary px-2.5 py-1">
                <Text className="text-xs">💪</Text>
                <Text className="text-xs font-medium text-text-accent">
                  {prs} {t('recentWorkouts.prs')}
                </Text>
              </View>
            )}
          </View>
        </View>
        <CircularArrow />
      </View>
    </GenericCard>
  );
}
