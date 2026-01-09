import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { theme } from '../../../theme';

type TestNumericInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  unit: string;
  unitColor?: string;
};

export function TestNumericInput({
  label,
  value,
  onChangeText,
  unit,
  unitColor = theme.colors.accent.primary,
}: TestNumericInputProps) {
  return (
    <View className="flex-1 flex-col items-center gap-1 rounded-lg border border-white/10 bg-bg-card p-4">
      <Text className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
        {label}
      </Text>
      <TextInput
        className="w-full border-none bg-transparent p-0 text-center text-3xl font-black text-text-primary"
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        style={{ borderWidth: 0 }}
      />
      <Text className="text-xs font-medium" style={{ color: unitColor }}>
        {unit}
      </Text>
    </View>
  );
}
