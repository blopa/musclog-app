import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { theme } from '../../theme';

type BodyMetricCardProps = {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  sublabel: string;
  value: number;
  unit: string;
  unitLabel: string;
  min: number;
  max: number;
  step?: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onChangeValue: (value: number) => void;
};

export function BodyMetricsStepper({
  icon: Icon,
  label,
  sublabel,
  value,
  unit,
  unitLabel,
  min,
  max,
  step = 1,
  onIncrement,
  onDecrement,
  onChangeValue,
}: BodyMetricCardProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(
    unit === 'index' ? value.toFixed(1) : value.toString()
  );
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!editing) {
      setInputValue(unit === 'index' ? value.toFixed(1) : value.toString());
    }
  }, [value, editing, unit]);

  const handleDecrement = () => {
    const newVal = Math.max(min, value - step);
    onChangeValue(newVal);
    onDecrement();
  };

  const handleIncrement = () => {
    const newVal = Math.min(max, value + step);
    onChangeValue(newVal);
    onIncrement();
  };

  const handleValuePress = () => {
    setEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleInputChange = (text: string) => {
    // Allow numbers and decimal points
    if (/^\d*\.?\d*$/.test(text)) {
      setInputValue(text);
    }
  };

  const handleInputBlur = () => {
    setEditing(false);
    const num = parseFloat(inputValue);
    if (!isNaN(num)) {
      // Clamp between min and max
      const clamped = Math.min(max, Math.max(min, num));
      onChangeValue(clamped);
    } else {
      setInputValue(unit === 'index' ? value.toFixed(1) : value.toString());
    }
  };

  const handleInputSubmit = () => {
    inputRef.current?.blur();
  };

  return (
    <View
      className="rounded-xl border bg-bg-card p-5"
      style={{ borderColor: theme.colors.border.emerald }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: theme.colors.accent.primary10 }}>
            <Icon size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </View>
          <View>
            <Text className="font-semibold text-text-primary">{label}</Text>
            <Text className="text-xs text-text-secondary">{sublabel}</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full border"
            style={{
              backgroundColor: theme.colors.accent.primary10,
              borderColor: `${theme.colors.accent.primary}33`,
            }}
            onPress={handleDecrement}>
            <Minus size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </Pressable>
          <View className="w-16 items-center">
            {editing ? (
              <TextInput
                ref={inputRef}
                value={inputValue}
                onChangeText={handleInputChange}
                onBlur={handleInputBlur}
                onSubmitEditing={handleInputSubmit}
                keyboardType="numeric"
                className="text-center text-xl font-bold text-text-primary"
                style={{
                  padding: theme.spacing.padding.zero,
                  margin: theme.spacing.margin.zero,
                  width: '100%',
                }}
                returnKeyType="done"
                selectTextOnFocus
              />
            ) : (
              <Pressable onPress={handleValuePress} className="w-full items-center">
                <Text className="text-xl font-bold text-text-primary">
                  {unit === 'index' ? value.toFixed(1) : value}
                </Text>
              </Pressable>
            )}
            <Text className="text-xs text-text-secondary">{unitLabel}</Text>
          </View>
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full border"
            style={{
              backgroundColor: theme.colors.accent.primary10,
              borderColor: `${theme.colors.accent.primary}33`,
            }}
            onPress={handleIncrement}>
            <Plus size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
