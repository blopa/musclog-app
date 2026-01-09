import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { ChevronUp, ChevronDown } from 'lucide-react-native';
import { theme } from '../../../theme';

type TestNumericInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  unit: string;
  unitColor?: string;
  onIncrement?: () => void;
  onDecrement?: () => void;
};

export function TestNumericInput({
  label,
  value,
  onChangeText,
  unit,
  unitColor = theme.colors.accent.primary,
  onIncrement,
  onDecrement,
}: TestNumericInputProps) {
  return (
    <View className="flex-1 flex-col items-center gap-1 rounded-lg border border-white/10 bg-bg-card p-4">
      <Text className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
        {label}
      </Text>
      {onIncrement && (
        <Pressable
          className="w-full items-center justify-center rounded-lg bg-accent-primary py-1.5 active:opacity-80"
          onPress={onIncrement}>
          <ChevronUp size={16} color={theme.colors.text.black} />
        </Pressable>
      )}
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
      {onDecrement && (
        <Pressable
          className="w-full items-center justify-center rounded-lg bg-accent-primary py-1.5 active:opacity-80"
          onPress={onDecrement}>
          <ChevronDown size={16} color={theme.colors.text.black} />
        </Pressable>
      )}
    </View>
  );
}
