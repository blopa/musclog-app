import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { theme } from '../theme';

type MealTypeButtonProps = {
  icon: LucideIcon;
  label: string;
  iconBgColor: string;
  iconColor: string;
  onPress: () => void;
  span?: number;
};

export function MealTypeButton({
  icon: Icon,
  label,
  iconBgColor,
  iconColor,
  onPress,
  span = 1,
}: MealTypeButtonProps) {
  return (
    <Pressable
      className={`${
        span === 2 ? 'flex-row' : 'flex-col'
      } active:bg-bg-card-elevated items-center justify-center gap-2 rounded-2xl border border-border-default bg-bg-overlay p-3 active:scale-95`}
      style={{ minHeight: theme.size['22'] }}
      onPress={onPress}>
      <View
        className={`${span === 2 ? 'h-8 w-8' : 'h-10 w-10'} items-center justify-center rounded-full`}
        style={{ backgroundColor: iconBgColor }}>
        <Icon size={span === 2 ? theme.iconSize.sm : theme.iconSize.md} color={iconColor} />
      </View>
      <Text className="text-xs font-medium text-text-primary">{label}</Text>
    </Pressable>
  );
}
