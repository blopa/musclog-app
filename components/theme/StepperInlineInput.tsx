import { LucideIcon, Minus, Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';

type TestStepperProps = {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onChangeValue?: (newValue: number) => void;
  unit?: string;
  icon?: LucideIcon;
  subtitle?: string;
  iconSize?: 'sm' | 'md';
  step?: number;
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
  iconSize = 'md',
  step = 1,
}: TestStepperProps) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const formatValue = (v: number) => (v % 1 === 0 ? String(v) : v.toFixed(1));
  const [inputValue, setInputValue] = useState(formatValue(value));
  const inputRef = useRef<TextInput>(null);

  // Sync inputValue with value prop when not editing
  useEffect(() => {
    if (!editing) {
      setInputValue(formatValue(value));
    }
  }, [value, editing]);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidHide', () => {
      if (editing) {
        inputRef.current?.blur();
      }
    });
    return () => subscription.remove();
  }, [editing]);

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
      setInputValue(formatValue(value));
    }
  };

  const handleInputSubmit = () => {
    inputRef.current?.blur();
  };

  return (
    <View className="flex-row items-center justify-between overflow-hidden rounded-xl border border-emerald-900/20 bg-bg-card p-5">
      <View className="min-w-0 flex-1 flex-row items-center gap-3 pr-3">
        {Icon ? (
          <View
            className={`${iconSize === 'sm' ? 'h-8 w-8' : 'h-10 w-10'} flex-shrink-0 items-center justify-center rounded-lg`}
            style={{ backgroundColor: theme.colors.status.emerald20 }}
          >
            <Icon
              size={iconSize === 'sm' ? theme.iconSize.sm : theme.iconSize.md}
              color={theme.colors.status.emeraldLight}
            />
          </View>
        ) : null}
        <View className="min-w-0 flex-1">
          <Text className="font-semibold text-white" numberOfLines={1} ellipsizeMode="tail">
            {label}
          </Text>
          {subtitle ? (
            <Text className="text-xs text-gray-500" numberOfLines={1} ellipsizeMode="tail">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="flex-shrink-0 flex-row items-center gap-2">
        <Pressable
          className="h-10 min-w-[40px] items-center justify-center rounded-full border"
          style={{
            backgroundColor: theme.colors.accent.primary10,
            borderColor: theme.colors.accent.primary20,
          }}
          onPress={() => {
            if (editing) {
              setInputValue((prev) => {
                const num = parseFloat(prev) || 0;
                return formatValue(num - step);
              });
            }
            onDecrement();
          }}
        >
          <Minus size={theme.iconSize.lg} color={theme.colors.status.emeraldLight} />
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
                width: theme.size['4xl'],
                padding: theme.spacing.padding.zero,
                margin: theme.spacing.margin.zero,
                color: theme.colors.text.white,
              }}
              returnKeyType="done"
              selectTextOnFocus
            />
            {unit ? (
              <Text
                className="text-xs text-gray-500"
                style={{ fontSize: theme.typography.fontSize.xs }}
              >
                {unit}
              </Text>
            ) : null}
          </View>
        ) : (
          <Pressable onPress={handleValuePress} className="w-16 items-center">
            <Text className="text-xl font-bold text-white">
              {formatValue(value)}
            </Text>
            {unit ? (
              <Text
                className="text-xs text-gray-500"
                style={{ fontSize: theme.typography.fontSize.xs }}
              >
                {unit}
              </Text>
            ) : null}
          </Pressable>
        )}
        <Pressable
          className="h-10 min-w-[40px] items-center justify-center rounded-full border"
          style={{
            backgroundColor: theme.colors.accent.primary10,
            borderColor: theme.colors.accent.primary20,
          }}
          onPress={() => {
            if (editing) {
              setInputValue((prev) => {
                const num = parseFloat(prev) || 0;
                return formatValue(num + step);
              });
            }
            onIncrement();
          }}
        >
          <Plus size={theme.iconSize.lg} color={theme.colors.status.emeraldLight} />
        </Pressable>
      </View>
    </View>
  );
}
