import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { theme } from '../../../theme';

type TestStepperProps = {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  unit?: string;
};

export function TestStepper({ label, value, onIncrement, onDecrement, unit }: TestStepperProps) {
  return (
    <View className="flex-row items-center justify-between rounded-lg border border-white/10 bg-bg-card p-4">
      <View className="flex-col">
        <Text className="text-xs font-semibold uppercase tracking-tighter text-text-tertiary">
          {label}
        </Text>
        <Text className="text-lg font-bold text-text-primary">
          {value.toFixed(1)}{' '}
          {unit && <Text className="font-normal text-text-tertiary">{unit}</Text>}
        </Text>
      </View>
      <View className="flex-row items-center gap-3">
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-bg-cardElevated active:scale-95"
          onPress={onDecrement}>
          <Minus size={20} color={theme.colors.text.primary} />
        </Pressable>
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-lg bg-accent-primary active:scale-95"
          onPress={onIncrement}>
          <Plus size={20} color={theme.colors.text.black} />
        </Pressable>
      </View>
    </View>
  );
}
