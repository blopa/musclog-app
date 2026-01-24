import React from 'react';
import { Pressable, Text, View, ViewStyle } from 'react-native';
import { theme } from '../../theme';

type DashedButtonProps = {
  label: string;
  onPress?: () => void;
  size?: 'sm' | 'lg';
  icon?: React.ReactNode;
  style?: ViewStyle;
};

export default function DashedButton({
  label,
  onPress,
  size = 'sm',
  icon,
  style,
}: DashedButtonProps) {
  const isLarge = size === 'lg';

  if (isLarge) {
    return (
      <Pressable
        onPress={onPress}
        className="w-full items-center justify-center gap-4 rounded-xl border-2 border-dashed active:opacity-80"
        style={{
          borderColor: theme.colors.border.gray600,
          padding: theme.spacing.padding['4xl'] / 15 || theme.spacing.padding.lg, // approximate p-8
          backgroundColor: theme.colors.background.card,
          ...(style || {}),
        }}
      >
        <View
          className="h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: theme.colors.background.cardElevated }}
        >
          {icon}
        </View>
        <Text
          style={{
            color: theme.colors.text.primary,
            fontSize: theme.typography.fontSize.base,
            fontWeight: theme.typography.fontWeight.medium,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      className="w-full flex-row items-center justify-center gap-2 rounded-lg border-2 border-dashed py-4"
      style={[{ borderColor: theme.colors.border.dashed }, style]}
    >
      {icon}
      <Text
        style={{ color: theme.colors.text.secondary, fontWeight: theme.typography.fontWeight.bold }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
