import React, { useState, useRef } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Minus, Plus, LucideIcon } from 'lucide-react-native';
import { theme } from '../../theme';

type TestStepperProps = {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onChangeValue?: (newValue: number) => void;
  unit?: string;
  icon?: LucideIcon;
  subtitle?: string;
};

export function StepperInlineInput({
  label,
  value,
  onIncrement,
  onDecrement,
  onChangeValue,
  unit,
  icon: Icon,
  subtitle,
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
    <View className="flex-row items-center justify-between rounded-xl border border-emerald-900/20 bg-bg-card p-5">
      <View className="flex-row items-center gap-3">
        {Icon && (
          <View
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)' }}>
            <Icon size={20} color={theme.colors.status.emeraldLight} />
          </View>
        )}
        <View>
          <Text className="font-semibold text-white">{label}</Text>
          {subtitle && <Text className="text-xs text-gray-500">{subtitle}</Text>}
        </View>
      </View>
      <View className="flex-row items-center gap-3">
        <Pressable
          className="border-primary/20 h-10 w-10 items-center justify-center rounded-full border active:opacity-70"
          style={{ backgroundColor: 'rgba(16, 185, 129, 0.3)' }}
          onPress={onDecrement}>
          <Minus size={20} color={theme.colors.status.emeraldLight} />
        </Pressable>
        {editing ? (
          <View className="w-16 items-center">
            <TextInput
              ref={inputRef}
              value={inputValue}
              onChangeText={handleInputChange}
              onBlur={handleInputBlur}
              onSubmitEditing={handleInputSubmit}
              keyboardType="numeric"
              className="p-0 text-center text-xl font-bold text-white"
              style={{
                width: 64,
                padding: 0,
                margin: 0,
                color: theme.colors.text.white,
              }}
              returnKeyType="done"
              selectTextOnFocus
            />
            {unit && (
              <Text className="text-xs text-gray-500" style={{ fontSize: 10 }}>
                {unit}
              </Text>
            )}
          </View>
        ) : (
          <Pressable onPress={handleValuePress} className="w-16 items-center">
            <Text className="text-xl font-bold text-white">
              {value % 1 === 0 ? value : value.toFixed(1)}
            </Text>
            {unit && (
              <Text className="text-xs text-gray-500" style={{ fontSize: 10 }}>
                {unit}
              </Text>
            )}
          </Pressable>
        )}
        <Pressable
          className="border-primary/20 h-10 w-10 items-center justify-center rounded-full border active:opacity-70"
          style={{ backgroundColor: 'rgba(16, 185, 129, 0.3)' }}
          onPress={onIncrement}>
          <Plus size={20} color={theme.colors.status.emeraldLight} />
        </Pressable>
      </View>
    </View>
  );
}
