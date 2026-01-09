import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { theme } from '../../../theme';

type TestPickerButtonProps = {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
};

export function TestPickerButton({ label, icon, onPress }: TestPickerButtonProps) {
  return (
    <Pressable
      className="h-14 w-full flex-row items-center justify-between rounded-lg border border-white/10 bg-bg-card px-4 active:bg-white/5"
      onPress={onPress}>
      <View className="flex-row items-center gap-3">
        {icon}
        <Text className="font-medium text-text-primary">{label}</Text>
      </View>
      <ChevronDown size={20} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}
