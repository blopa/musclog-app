import React, { useState, useRef } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [internalValue, setInternalValue] = useState<number>(value);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value.toFixed(1));
  const inputRef = useRef<TextInput>(null);

  React.useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Sync inputValue with value prop when not editing
  React.useEffect(() => {
    if (!editing) {
      setInputValue(value.toFixed(1));
    }
  }, [value, editing]);

  const handleChange = (newValue: number) => {
    setInternalValue(newValue);
    onChangeValue?.(newValue);
  };

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
      setInternalValue(num);
    } else {
      // Reset to current value if invalid
      setInputValue(value.toFixed(1));
    }
  };

  const handleInputSubmit = () => {
    inputRef.current?.blur();
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
          accessibilityLabel={t('common.decreaseValue')}>
          <Minus size={20} color={theme.colors.accent.primary} />
        </Pressable>
        {editing ? (
          <View
            className="h-14 flex-1 flex-row items-center justify-center rounded-xl"
            style={{ backgroundColor: theme.colors.background.card }}>
            <TextInput
              ref={inputRef}
              value={inputValue}
              onChangeText={handleInputChange}
              onBlur={handleInputBlur}
              onSubmitEditing={handleInputSubmit}
              keyboardType="numeric"
              className="flex-1 p-0 text-center text-2xl font-bold text-text-primary"
              style={{
                padding: theme.spacing.padding.zero,
                margin: theme.spacing.margin.zero,
                color: theme.colors.text.primary,
              }}
              returnKeyType="done"
              selectTextOnFocus
            />
            {unit && <Text className="ml-1 text-2xl font-normal text-text-tertiary">{unit}</Text>}
          </View>
        ) : (
          <Pressable
            className="h-14 flex-1 items-center justify-center rounded-xl"
            style={{ backgroundColor: theme.colors.background.card }}
            onPress={handleValuePress}>
            <Text className="text-center text-2xl font-bold text-text-primary">
              {internalValue.toFixed(1)}{' '}
              {unit && <Text className="font-normal text-text-tertiary">{unit}</Text>}
            </Text>
          </Pressable>
        )}
        <Pressable
          className="h-14 w-14 items-center justify-center rounded-xl active:scale-95"
          style={{ backgroundColor: theme.colors.background.card }}
          onPress={() => {
            const newVal = internalValue + 1;
            handleChange(newVal);
            onIncrement();
          }}
          accessibilityLabel={t('common.increaseValue')}>
          <Plus size={20} color={theme.colors.accent.primary} />
        </Pressable>
      </View>
    </View>
  );
};
