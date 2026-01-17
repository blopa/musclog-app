import React, { useState } from 'react';
import { Text, TextInput as RNTextInput, View } from 'react-native';
import { theme } from '../theme';

type CaloriesInputVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent';
type CaloriesInputSize = 'full' | 'half';

type CaloriesInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  topRightElement: React.ReactNode;
  variant?: CaloriesInputVariant;
  size?: CaloriesInputSize;
};

const sizeConfig = {
  full: {
    widthClass: 'w-full',
    padding: 20, // p-5
    fontSize: theme.typography.fontSize['5xl'], // 48px
  },
  half: {
    widthClass: 'w-[48%]',
    padding: 16, // p-4
    fontSize: theme.typography.fontSize['4xl'], // 36px
  },
};

const variantColors: Record<CaloriesInputVariant, string> = {
  default: theme.colors.accent.primary,
  success: theme.colors.status.success,
  warning: theme.colors.status.warning,
  error: theme.colors.status.error,
  info: theme.colors.status.info,
  accent: theme.colors.accent.secondary,
};

const variantBorderColors: Record<CaloriesInputVariant, string> = {
  default: theme.colors.accent.primary50,
  success: theme.colors.accent.primary50,
  warning: theme.colors.status.warning + 50,
  error: theme.colors.status.error + 50,
  info: theme.colors.status.info + 50,
  accent: theme.colors.accent.secondary20,
};

export function CaloriesInput({
  label,
  value,
  onChange,
  topRightElement,
  variant = 'default',
  size = 'full',
}: CaloriesInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const highlightColor = variantColors[variant];
  const borderColor = variantBorderColors[variant];
  const config = sizeConfig[size];

  return (
    <View
      className={`overflow-hidden rounded-xl border border-white/10 bg-bg-card ${config.widthClass}`}
      style={{
        padding: config.padding,
        borderColor: isFocused ? borderColor : theme.colors.background.white10,
        shadowColor: highlightColor,
        shadowOffset: theme.shadowOffset.zero,
        shadowOpacity: theme.shadowOpacity.veryLight,
        shadowRadius: theme.shadows.radius8.shadowRadius,
        elevation: theme.elevation.sm,
      }}>
      <View className="mb-1 flex-row items-start justify-between">
        <Text className="text-xs font-bold uppercase tracking-widest text-text-secondary">
          {label}
        </Text>
        {topRightElement}
      </View>
      <RNTextInput
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={theme.colors.text.primary12}
        keyboardType="numeric"
        selectTextOnFocus
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="w-full border-0 bg-transparent p-0 font-bold text-text-primary"
        style={{
          fontSize: config.fontSize,
        }}
      />
      {isFocused && (
        <View
          className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl"
          style={{ backgroundColor: highlightColor }}
        />
      )}
    </View>
  );
}
