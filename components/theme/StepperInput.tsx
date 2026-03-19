import { Minus, Plus } from 'lucide-react-native';
import { FC, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useRepeatPress } from '../../hooks/useRepeatPress';
import { useTheme } from '../../hooks/useTheme';

interface StepperInputProps {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onChangeValue?: (newValue: number) => void;
  unit?: string;
}

export const StepperInput: FC<StepperInputProps> = ({
  label,
  value,
  onIncrement,
  onDecrement,
  onChangeValue,
  unit,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [internalValue, setInternalValue] = useState<number>(value);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value.toFixed(1));
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Sync inputValue with value prop when not editing
  useEffect(() => {
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

  const incrementHandlers = useRepeatPress({
    onPress: onIncrement,
  });

  const decrementHandlers = useRepeatPress({
    onPress: onDecrement,
  });

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
          style={{ backgroundColor: theme.colors.background.card }}
          {...decrementHandlers}
          accessibilityLabel={t('common.decreaseValue')}
        >
          <Minus size={theme.iconSize.lg} color={theme.colors.accent.primary} />
        </Pressable>
        {editing ? (
          <View
            className="h-14 min-w-0 flex-1 flex-row items-center justify-center rounded-xl"
            style={{ backgroundColor: theme.colors.background.card }}
          >
            <TextInput
              ref={inputRef}
              value={inputValue}
              onChangeText={handleInputChange}
              onBlur={handleInputBlur}
              onSubmitEditing={handleInputSubmit}
              keyboardType="numeric"
              className="min-w-0 flex-1 p-0 text-center text-2xl font-bold text-text-primary"
              style={{
                padding: theme.spacing.padding.zero,
                margin: theme.spacing.margin.zero,
                color: theme.colors.text.primary,
              }}
              returnKeyType="done"
              selectTextOnFocus
            />
            {unit ? (
              <Text className="ml-1 flex-shrink-0 text-2xl font-normal text-text-tertiary">
                {unit}
              </Text>
            ) : null}
          </View>
        ) : (
          <Pressable
            className="h-14 min-w-0 flex-1 items-center justify-center rounded-xl"
            style={{ backgroundColor: theme.colors.background.card }}
            onPress={handleValuePress}
          >
            <Text
              className="text-center text-2xl font-bold text-text-primary"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {internalValue.toFixed(1)}{' '}
              {unit ? <Text className="font-normal text-text-tertiary">{unit}</Text> : null}
            </Text>
          </Pressable>
        )}
        <Pressable
          className="h-14 min-w-[56px] flex-shrink-0 items-center justify-center rounded-xl active:scale-95"
          style={{ backgroundColor: theme.colors.background.card }}
          {...incrementHandlers}
          accessibilityLabel={t('common.increaseValue')}
        >
          <Plus size={theme.iconSize.lg} color={theme.colors.accent.primary} />
        </Pressable>
      </View>
    </View>
  );
};
