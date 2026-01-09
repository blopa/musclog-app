import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { theme } from '../../theme';

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

  React.useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleChange = (newValue: number) => {
    setInternalValue(newValue);
    onChangeValue?.(newValue);
  };

  return (
    <View className="flex flex-col gap-2">
      <Text
        className="text-xs font-bold uppercase tracking-tighter"
        style={{ color: theme.colors.accent.primary }}>
        {label}
      </Text>
      <View className="flex flex-row items-center gap-3">
        <Pressable
          className="h-14 w-14 items-center justify-center rounded-xl active:scale-95"
          style={{ backgroundColor: theme.colors.background.card }}
          onPress={() => {
            const newVal = internalValue - 1;
            handleChange(newVal);
            onDecrement();
          }}
          accessibilityLabel="Decrease value">
          <Minus size={20} color={theme.colors.accent.primary} />
        </Pressable>
        <View
          className="h-14 flex-1 items-center justify-center rounded-xl"
          style={{ backgroundColor: theme.colors.background.card }}>
          <Text className="text-center text-2xl font-bold text-text-primary">
            {internalValue.toFixed(1)}{' '}
            {unit && <Text className="font-normal text-text-tertiary">{unit}</Text>}
          </Text>
        </View>
        <Pressable
          className="h-14 w-14 items-center justify-center rounded-xl active:scale-95"
          style={{ backgroundColor: theme.colors.background.card }}
          onPress={() => {
            const newVal = internalValue + 1;
            handleChange(newVal);
            onIncrement();
          }}
          accessibilityLabel="Increase value">
          <Plus size={20} color={theme.colors.accent.primary} />
        </Pressable>
      </View>
    </View>
  );
};

export default StepperInput;
