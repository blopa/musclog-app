import React, { useState, useRef } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { theme } from '../../../theme';

type TestStepperProps = {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onChangeValue?: (newValue: number) => void;
  unit?: string;
};

export function TestStepper({
  label,
  value,
  onIncrement,
  onDecrement,
  onChangeValue,
  unit,
}: TestStepperProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value.toFixed(1));
  const inputRef = useRef<TextInput>(null);

  // Sync inputValue with value prop when not editing
  React.useEffect(() => {
    if (!editing) {
      setInputValue(value.toFixed(1));
    }
  }, [value, editing]);

  const handleValuePress = () => {
    setEditing(true);
    // Small delay to ensure state update before focusing
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleInputChange = (text: string) => {
    // Allow only numbers, decimal point, and optional minus sign
    if (/^-?\d*\.?\d*$/.test(text)) {
      setInputValue(text);
    }
  };

  const handleInputBlur = () => {
    setEditing(false);
    const num = parseFloat(inputValue);
    if (!isNaN(num) && onChangeValue) {
      onChangeValue(num);
    } else {
      // Reset to current value if invalid
      setInputValue(value.toFixed(1));
    }
  };

  const handleInputSubmit = () => {
    inputRef.current?.blur();
  };

  return (
    <View className="flex-row items-center justify-between rounded-lg border border-white/10 bg-bg-card p-4">
      <View className="flex-1 flex-col">
        <Text className="text-xs font-semibold uppercase tracking-tighter text-text-tertiary">
          {label}
        </Text>
        {editing ? (
          <View className="mr-6 flex-row items-center">
            <TextInput
              ref={inputRef}
              value={inputValue}
              onChangeText={handleInputChange}
              onBlur={handleInputBlur}
              onSubmitEditing={handleInputSubmit}
              keyboardType="numeric"
              className="p-0 text-lg font-bold text-text-primary"
              style={{
                width: 200,
                padding: 0,
                margin: 0,
                color: theme.colors.text.primary,
              }}
              returnKeyType="done"
              selectTextOnFocus
            />
            {unit && <Text className="ml-1 text-lg font-normal text-text-tertiary">{unit}</Text>}
          </View>
        ) : (
          <Pressable onPress={handleValuePress}>
            <Text className="text-lg font-bold text-text-primary">
              {value.toFixed(1)}{' '}
              {unit && <Text className="font-normal text-text-tertiary">{unit}</Text>}
            </Text>
          </Pressable>
        )}
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
