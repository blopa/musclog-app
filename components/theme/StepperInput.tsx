import { Minus, Plus } from 'lucide-react-native';
import { FC, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';

interface StepperInputProps {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onChangeValue?: (newValue: number) => void;
  unit?: string;
  step?: number;
  variant?: 'default' | 'portion';
}

export const StepperInput: FC<StepperInputProps> = ({
  label,
  value,
  onIncrement,
  onDecrement,
  onChangeValue,
  unit,
  step = 1,
  variant = 'default',
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isPortion = variant === 'portion';
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
    <View className="flex flex-col gap-2">
      <Text
        className="text-xs font-bold uppercase tracking-tighter"
        style={{ color: theme.colors.accent.primary }}
      >
        {label}
      </Text>
      <View className="flex flex-row items-center gap-2 overflow-hidden">
        <Pressable
          className="h-14 min-w-[56px] flex-shrink-0 items-center justify-center rounded-xl active:scale-95"
          style={{
            backgroundColor: isPortion
              ? theme.colors.background.greenBlob
              : theme.colors.background.card,
          }}
          onPress={() => {
            if (editing) {
              const num = parseFloat(inputValue) || 0;
              setInputValue(formatValue(num - step));
            }
            onDecrement();
          }}
          accessibilityLabel={t('common.decreaseValue')}
        >
          <Minus
            size={theme.iconSize.lg}
            color={isPortion ? theme.colors.text.onColorful : theme.colors.accent.primary}
          />
        </Pressable>
        {editing ? (
          <View
            className="h-14 min-w-0 flex-1 flex-row items-center justify-center rounded-xl"
            style={{
              backgroundColor: isPortion ? 'transparent' : theme.colors.background.card,
            }}
          >
            <TextInput
              ref={inputRef}
              value={inputValue}
              onChangeText={handleInputChange}
              onBlur={handleInputBlur}
              onSubmitEditing={handleInputSubmit}
              keyboardType="numeric"
              className={`min-w-0 flex-1 p-0 text-center font-bold text-text-primary ${isPortion ? 'text-4xl' : 'text-2xl'}`}
              style={{
                padding: theme.spacing.padding.zero,
                margin: theme.spacing.margin.zero,
                color: theme.colors.text.primary,
              }}
              returnKeyType="done"
              selectTextOnFocus
            />
            {unit ? (
              <Text
                className={`ml-1 mr-2 flex-shrink-0 font-normal text-text-tertiary ${isPortion ? 'text-4xl' : 'text-2xl'}`}
              >
                {unit}
              </Text>
            ) : null}
          </View>
        ) : (
          <Pressable
            className="h-14 min-w-0 flex-1 items-center justify-center rounded-xl"
            style={{
              backgroundColor: isPortion ? 'transparent' : theme.colors.background.card,
            }}
            onPress={handleValuePress}
          >
            <Text
              className={`text-center font-bold text-text-primary ${isPortion ? 'text-4xl' : 'text-2xl'}`}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {formatValue(value)}{' '}
              {unit ? <Text className="font-normal text-text-tertiary">{unit}</Text> : null}
            </Text>
          </Pressable>
        )}
        <Pressable
          className="h-14 min-w-[56px] flex-shrink-0 items-center justify-center rounded-xl active:scale-95"
          style={{
            backgroundColor: isPortion ? theme.colors.accent.primary : theme.colors.background.card,
          }}
          onPress={() => {
            if (editing) {
              const num = parseFloat(inputValue) || 0;
              setInputValue(formatValue(num + step));
            }
            onIncrement();
          }}
          accessibilityLabel={t('common.increaseValue')}
        >
          <Plus
            size={theme.iconSize.lg}
            color={isPortion ? theme.colors.text.onColorful : theme.colors.accent.primary}
          />
        </Pressable>
      </View>
    </View>
  );
};
