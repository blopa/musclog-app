import { ReactNode, useState } from 'react';
import { Pressable, Text, View, ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type DashedButtonProps = {
  label: string;
  onPress?: () => void;
  size?: 'sm' | 'lg';
  icon?: ReactNode;
  style?: ViewStyle;
};

export default function DashedButton({
  label,
  onPress,
  size = 'sm',
  icon,
  style,
}: DashedButtonProps) {
  const theme = useTheme();
  const [isPressed, setIsPressed] = useState(false);
  const isLarge = size === 'lg';

  if (isLarge) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        className="w-full items-center justify-center gap-4 rounded-xl border-2 border-dashed"
        style={{
          borderColor: theme.colors.border.gray600,
          padding: theme.spacing.padding.sm,
          paddingVertical: theme.spacing.padding.lg,
          backgroundColor: isPressed
            ? theme.colors.background.cardElevated
            : theme.colors.background.card,
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
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      className="w-full flex-row items-center justify-center gap-2 rounded-lg border-2 border-dashed py-4"
      style={{
        borderColor: theme.colors.border.dashed,
        backgroundColor: isPressed ? theme.colors.background.cardElevated : 'transparent',
        ...(style || {}),
      }}
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
