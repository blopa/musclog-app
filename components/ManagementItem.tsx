import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { theme, addOpacityToHex } from '../theme';

type ManagementItemProps = {
  title: string;
  description: string;
  icon: React.ComponentType<{ size: number; color: string }>;
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
  return (
    <Pressable
      className="active:bg-bg-card-elevated flex-row items-center gap-4 rounded-2xl border border-border-default bg-bg-overlay p-4"
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
        <Text className="text-lg font-semibold text-text-primary">{title}</Text>
        <Text className="mt-0.5 text-sm text-text-secondary">{description}</Text>
      </View>
      <ChevronRight size={theme.iconSize.md} color={theme.colors.text.secondary} />
    </Pressable>
  );
}
