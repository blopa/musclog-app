import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Check } from 'lucide-react-native';
import { theme } from '../../theme';

type TestToggleProps = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  type?: 'checkbox' | 'radio';
};

export function Toggle({ label, value, onValueChange, type = 'checkbox' }: TestToggleProps) {
  return (
    <Pressable
      className="flex-row items-center gap-3 active:opacity-90"
      onPress={() => onValueChange(!value)}>
      <View
        className={`h-6 w-6 items-center justify-center border border-white/20 bg-bg-card ${
          type === 'radio' ? 'rounded-full' : 'rounded'
        }`}>
        {value &&
          (type === 'checkbox' ? (
            <Check size={16} color={theme.colors.accent.primary} />
          ) : (
            <View
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: theme.colors.accent.primary }}
            />
          ))}
      </View>
      <Text className="text-sm font-medium text-text-primary">{label}</Text>
    </Pressable>
  );
}
