import React from 'react';
import { Pressable, Text, ViewStyle } from 'react-native';
import { Plus as PlusIcon } from 'lucide-react-native';
import { theme } from '../../theme';

type AddNewSetButtonProps = {
  onPress?: () => void;
  style?: ViewStyle;
};

export default function AddNewSetButton({ onPress, style }: AddNewSetButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="w-full flex-row items-center justify-center gap-2 rounded-lg border-2 border-dashed py-4"
      style={[{ borderColor: theme.colors.border.dashed }, style]}
    >
      <PlusIcon size={theme.iconSize.sm} color={theme.colors.background.workoutIcon} />
      <Text
        style={{ color: theme.colors.text.secondary, fontWeight: theme.typography.fontWeight.bold }}
      >
        Add New Set
      </Text>
    </Pressable>
  );
}
