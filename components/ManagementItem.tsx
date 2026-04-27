import { ChevronRight } from 'lucide-react-native';
import { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { addOpacityToHex } from '@/theme';

type ManagementItemProps = {
  title: string;
  description: string;
  icon: ComponentType<{ size: number; color: string }>;
  iconColor: string;
  onPress?: () => void;
};

export function ManagementItem({
  title,
  description,
  icon: Icon,
  iconColor,
  onPress,
}: ManagementItemProps) {
  const theme = useTheme();
  return (
    <Pressable
      className="active:bg-bg-card-elevated border-border-default bg-bg-overlay flex-row items-center gap-4 rounded-2xl border p-4"
      onPress={onPress}
    >
      <View
        className="h-12 w-12 items-center justify-center rounded-xl"
        style={{
          backgroundColor: addOpacityToHex(iconColor, theme.colors.opacity.subtle),
        }}
      >
        <Icon size={theme.iconSize.md} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text className="text-text-primary text-lg font-semibold">{title}</Text>
        <Text className="text-text-secondary mt-0.5 text-sm">{description}</Text>
      </View>
      <ChevronRight size={theme.iconSize.md} color={theme.colors.text.secondary} />
    </Pressable>
  );
}
