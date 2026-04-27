import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, LucideIcon } from 'lucide-react-native';
import { ReactNode } from 'react';
import { Image, ImageSourcePropType, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './GenericCard';

type DetailedItemCardProps = {
  item: {
    name: string;
    media: ImageSourcePropType | { icon: LucideIcon; color: string };
    itemOne: { value: string | number; icon: LucideIcon };
    itemTwo: { value: string | number; icon: LucideIcon };
    itemThree: { value: string | number; icon: LucideIcon };
  };
  onPress?: () => void;
  ctaLabel?: ReactNode;
  description?: string;
};

export function DetailedItemCard({ item, onPress, ctaLabel, description }: DetailedItemCardProps) {
  const theme = useTheme();
  return (
    <GenericCard variant="highlighted" isPressable={true} onPress={onPress} size="sm">
      <View className="flex-row items-center gap-4 p-4">
        {/* Media */}
        <View className="bg-bg-overlay relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
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
          {ctaLabel}
          <Text className="text-text-primary mt-1 truncate text-lg leading-tight font-bold">
            {item.name}
          </Text>
          {description ? <Text className="text-text-secondary text-sm">{description}</Text> : null}

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
