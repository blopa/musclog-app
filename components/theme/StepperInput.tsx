import { Minus, Plus } from 'lucide-react-native';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import {
  getDecimalSeparator,
  parseLocalizedDecimalString,
  sanitizeLocalizedIntegerInput,
  sanitizeLocalizedSignedDecimalInput,
} from '@/utils/localizedDecimalInput';

interface StepperInputProps {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onChangeValue?: (newValue: number) => void;
  onFocus?: () => void;
  unit?: string;
  step?: number;
  variant?: 'default' | 'portion';
  /** 0 = integer only (sets, reps); 1+ = locale decimal separator (e.g. weight). Default 1. */
  maxFractionDigits?: number;
}

export const StepperInput: FC<StepperInputProps> = ({
  label,
  value,
  onIncrement,
  onDecrement,
  onChangeValue,
  onFocus,
  unit,
  step = 1,
  variant = 'default',
  maxFractionDigits = 1,
}) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { formatDecimal, formatInteger } = useFormatAppNumber();
  const decimalSeparator = useMemo(
    () => getDecimalSeparator(i18n.resolvedLanguage ?? i18n.language),
    [i18n.resolvedLanguage, i18n.language]
  );
  const formatValue = useCallback(
    (v: number) =>
      maxFractionDigits === 0
        ? formatInteger(v, { useGrouping: false })
        : v % 1 === 0
          ? formatInteger(v, { useGrouping: false })
          : formatDecimal(v, maxFractionDigits),
    [formatDecimal, formatInteger, maxFractionDigits]
  );
  const isPortion = variant === 'portion';

  const valueFontSize = isPortion
    ? theme.typography.fontSize['4xl']
    : theme.typography.fontSize['2xl'];
  const unitFontSize = theme.typography.fontSize['2xl'];
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(() => formatValue(value));
  const inputRef = useRef<TextInput>(null);

  // Sync inputValue with value prop when not editing
  useEffect(() => {
    if (!editing) {
      setInputValue(formatValue(value));
    }
  }, [value, editing, formatValue]);

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
    onFocus?.();
    // Small delay to ensure state update before focusing
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleInputChange = (text: string) => {
    if (maxFractionDigits === 0) {
      const sanitized = sanitizeLocalizedIntegerInput(text);
      setInputValue(sanitized);
      if (sanitized === '') {
        return;
      }
      const num = parseInt(sanitized, 10);
      if (!Number.isNaN(num) && onChangeValue) {
        onChangeValue(num);
      }
      return;
    }

    const sanitized = sanitizeLocalizedSignedDecimalInput(
      text,
      decimalSeparator,
      maxFractionDigits
    );
    setInputValue(sanitized);
    if (sanitized === '' || sanitized === '-') {
      return;
    }
    const num = parseLocalizedDecimalString(sanitized, decimalSeparator, maxFractionDigits);
    if (onChangeValue) {
      onChangeValue(num);
    }
  };

  const handleInputBlur = () => {
    setEditing(false);
    if (maxFractionDigits === 0) {
      const num = parseInt(inputValue, 10);
      if (!Number.isNaN(num) && onChangeValue) {
        onChangeValue(num);
      } else {
        setInputValue(formatValue(value));
      }
      return;
    }
    const num = parseLocalizedDecimalString(inputValue, decimalSeparator, maxFractionDigits);
    if (inputValue.trim() !== '' && inputValue.trim() !== '-' && onChangeValue) {
      onChangeValue(num);
    } else {
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
              setInputValue((prev) => {
                const num =
                  maxFractionDigits === 0
                    ? parseInt(prev, 10) || 0
                    : parseLocalizedDecimalString(prev, decimalSeparator, maxFractionDigits);
                return formatValue(num - step);
              });
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
              keyboardType={maxFractionDigits === 0 ? 'numeric' : 'decimal-pad'}
              className="min-w-0 flex-1 p-0 text-center font-bold text-text-primary"
              style={{
                padding: theme.spacing.padding.zero,
                margin: theme.spacing.margin.zero,
                color: theme.colors.text.primary,
                fontSize: valueFontSize,
              }}
              returnKeyType="done"
              selectTextOnFocus
            />
            {unit ? (
              <Text
                className="ml-1 mr-2 flex-shrink-0 font-normal text-text-tertiary"
                style={{ fontSize: unitFontSize }}
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
              className="text-center font-bold text-text-primary"
              style={{ fontSize: valueFontSize }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {formatValue(value)}{' '}
              {unit ? (
                <Text className="font-normal text-text-tertiary" style={{ fontSize: unitFontSize }}>
                  {unit}
                </Text>
              ) : null}
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
              setInputValue((prev) => {
                const num =
                  maxFractionDigits === 0
                    ? parseInt(prev, 10) || 0
                    : parseLocalizedDecimalString(prev, decimalSeparator, maxFractionDigits);
                return formatValue(num + step);
              });
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
