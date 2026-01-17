import { View, Text, Image, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { GenericCard } from './GenericCard';

type UpNextExerciseCardProps = {
  item: {
    name: string;
    media: ImageSourcePropType | { icon: LucideIcon; color: string };
    itemOne: { value: string | number; icon: LucideIcon };
    itemTwo: { value: string | number; icon: LucideIcon };
    itemThree: { value: string | number; icon: LucideIcon };
  };
  onPress?: () => void;
};

export function UpNextExerciseCard({ item, onPress }: UpNextExerciseCardProps) {
  const { t } = useTranslation();

  return (
    <GenericCard variant="highlighted" isPressable={true} onPress={onPress} size="sm">
      <View className="flex-row items-center gap-4 p-4">
        {/* Media */}
        <View className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-bg-overlay">
          {typeof item.media === 'object' && 'icon' in item.media ? (
            <item.media.icon
              size={theme.iconSize.xl}
              color={item.media.color}
              style={{ alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto' }}
            />
          ) : (
            <Image source={item.media} className="h-full w-full" resizeMode="cover" />
          )}
          <LinearGradient
            colors={['transparent', theme.colors.overlay.black60]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              position: 'absolute',
              top: theme.spacing.padding.zero,
              left: theme.spacing.padding.zero,
              right: theme.spacing.padding.zero,
              bottom: theme.spacing.padding.zero,
            }}
          />
        </View>

        {/* Info */}
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-start justify-between">
            <View className="flex-1" />
            <View className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5">
              <Text
                className="font-bold uppercase tracking-widest text-accent-primary"
                style={{ fontSize: theme.typography.fontSize.xs }}>
                {t('restTimer.upNext')}
              </Text>
            </View>
          </View>

          <Text className="mt-1 truncate text-lg font-bold leading-tight text-text-primary">
            {item.name}
          </Text>

          <View className="mt-1 flex-row items-center gap-3">
            <View className="flex-row items-center gap-1">
              <item.itemOne.icon size={theme.iconSize.sm} color={theme.colors.text.secondary} />
              <Text className="text-sm" style={{ color: theme.colors.overlay.white60 }}>
                {item.itemOne.value}
              </Text>
            </View>
            <View
              className="h-1 w-1 rounded-full"
              style={{ backgroundColor: theme.colors.overlay.white20 }}
            />
            <View className="flex-row items-center gap-1">
              <item.itemTwo.icon size={theme.iconSize.sm} color={theme.colors.text.secondary} />
              <Text className="text-sm" style={{ color: theme.colors.overlay.white60 }}>
                {item.itemTwo.value}
              </Text>
            </View>
            <View
              className="h-1 w-1 rounded-full"
              style={{ backgroundColor: theme.colors.overlay.white20 }}
            />
            <View className="flex-row items-center gap-1">
              <item.itemThree.icon size={theme.iconSize.sm} color={theme.colors.text.secondary} />
              <Text className="text-sm font-medium" style={{ color: theme.colors.overlay.white80 }}>
                {item.itemThree.value}
              </Text>
            </View>
          </View>
        </View>

        {/* Chevron */}
        <View className="self-center">
          <ChevronRight size={theme.iconSize.md} color={theme.colors.text.tertiary} />
        </View>
      </View>
    </GenericCard>
  );
}
