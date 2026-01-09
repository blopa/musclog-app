import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';

interface StepperInputProps {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onChangeValue?: (newValue: number) => void;
  unit?: string;
}

export const StepperInput: React.FC<StepperInputProps> = ({
  label,
  value,
  onIncrement,
  onDecrement,
  onChangeValue,
  unit,
}) => {
  const [internalValue, setInternalValue] = useState<number>(value);

  const handleChange = (newValue: number) => {
    setInternalValue(newValue);
    onChangeValue?.(newValue);
  };

  return (
    <View className="flex flex-col gap-1">
      <Text className="ml-1 text-xs font-bold uppercase tracking-widest text-emerald-500">
        {label}
      </Text>
      <View className="flex flex-row items-center gap-3">
        <TouchableOpacity
          className="bg-surface-dark-lighter flex h-14 w-14 items-center justify-center rounded-2xl border border-white/5 transition-transform active:scale-95"
          onPress={() => {
            handleChange(internalValue - 1);
            onDecrement();
          }}
          accessibilityLabel="Decrease value">
          <Minus size={20} color="white" />
        </TouchableOpacity>
        <View className="bg-surface-dark flex h-14 flex-1 items-center justify-center rounded-2xl border border-white/10">
          <Text className="text-center text-2xl font-bold text-white">
            {internalValue.toFixed(1)}{' '}
            {unit && <Text className="font-normal text-text-tertiary">{unit}</Text>}
          </Text>
        </View>
        <TouchableOpacity
          className="bg-surface-dark-lighter flex h-14 w-14 items-center justify-center rounded-2xl border border-white/5 transition-transform active:scale-95"
          onPress={() => {
            handleChange(internalValue + 1);
            onIncrement();
          }}
          accessibilityLabel="Increase value">
          <Plus size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default StepperInput;
