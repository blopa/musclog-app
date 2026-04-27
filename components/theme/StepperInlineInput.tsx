import { LucideIcon, Minus, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import {
  getDecimalSeparator,
  parseLocalizedDecimalString,
  sanitizeLocalizedIntegerInput,
  sanitizeLocalizedSignedDecimalInput,
} from '@/utils/localizedDecimalInput';

type StepperInlineInputProps = {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onChangeValue?: (newValue: number) => void;
  onFocus?: () => void;
  unit?: string;
  icon?: LucideIcon;
  subtitle?: string;
  iconSize?: 'sm' | 'md';
  step?: number;
  /** 0 = integer only; 1+ = locale decimal separator. Default 1. */
  maxFractionDigits?: number;
};

export function StepperInlineInput({
  label,
  value,
  onIncrement,
  onDecrement,
  onChangeValue,
  onFocus,
  unit,
  icon: Icon,
  subtitle,
  iconSize = 'md',
  step = 1,
  maxFractionDigits = 1,
}: StepperInlineInputProps) {
  const theme = useTheme();
  const { i18n } = useTranslation();
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
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(() => formatValue(value));
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!editing) {
      setInputValue(formatValue(value));
    }
  }, [value, editing, formatValue]);

  useEffect(() => {
    const subscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        if (editing) {
          inputRef.current?.blur();
        }
      }
    );

    return () => subscription.remove();
  }, [editing]);

  const handleValuePress = () => {
    setEditing(true);
    onFocus?.();
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
    if (inputValue.trim() !== '' && inputValue.trim() !== '-' && onChangeValue) {
      const num = parseLocalizedDecimalString(inputValue, decimalSeparator, maxFractionDigits);
      onChangeValue(num);
    } else {
      setInputValue(formatValue(value));
    }
  };

  const handleInputSubmit = () => {
    inputRef.current?.blur();
  };

  const parseCurrent = useCallback(
    (prev: string) =>
      maxFractionDigits === 0
        ? parseInt(prev, 10) || 0
        : parseLocalizedDecimalString(prev, decimalSeparator, maxFractionDigits),
    [decimalSeparator, maxFractionDigits]
  );

  return (
    <View className="bg-bg-card flex-row items-center justify-between overflow-hidden rounded-xl border border-emerald-900/20 p-5">
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
              setInputValue((prev) => formatValue(parseCurrent(prev) - step));
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
              keyboardType={maxFractionDigits === 0 ? 'numeric' : 'decimal-pad'}
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
            <Text className="text-xl font-bold text-white">{formatValue(value)}</Text>
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
              setInputValue((prev) => formatValue(parseCurrent(prev) + step));
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
