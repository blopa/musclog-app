import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface WeightStepperProps {
  label?: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
}

export const StepperInput: React.FC<WeightStepperProps> = ({
  label,
  value = 24,
  min = 0,
  max = 999,
  step = 1,
  onChange,
}) => {
  const [internalValue, setInternalValue] = useState<number>(value);

  const handleChange = (newValue: number) => {
    if (newValue < min || newValue > max) return;
    setInternalValue(newValue);
    onChange?.(newValue);
  };

  return (
    <View className="flex flex-col gap-1">
      <Text className="ml-1 text-xs font-bold uppercase tracking-widest text-emerald-500">
        {label}
      </Text>
      <View className="flex flex-row items-center gap-3">
        <TouchableOpacity
          className="bg-surface-dark-lighter flex h-14 w-14 items-center justify-center rounded-2xl border border-white/5 transition-transform active:scale-95"
          onPress={() => handleChange(internalValue - step)}
          accessibilityLabel="Decrease weight">
          <Text className="text-2xl font-bold text-emerald-500">-</Text>
        </TouchableOpacity>
        <View className="bg-surface-dark flex h-14 flex-1 items-center justify-center rounded-2xl border border-white/10">
          <Text className="text-center text-2xl font-bold text-white">{internalValue}</Text>
        </View>
        <TouchableOpacity
          className="bg-surface-dark-lighter flex h-14 w-14 items-center justify-center rounded-2xl border border-white/5 transition-transform active:scale-95"
          onPress={() => handleChange(internalValue + step)}
          accessibilityLabel="Increase weight">
          <Text className="text-2xl font-bold text-emerald-500">+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default StepperInput;
