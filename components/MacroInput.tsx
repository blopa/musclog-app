import React, { useState } from 'react';
import { Text, TextInput as RNTextInput, View } from 'react-native';
import { theme } from '../theme';

type MacroInputVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent';
type MacroInputSize = 'full' | 'half';

type MacroInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  topRightElement: React.ReactNode;
  variant?: MacroInputVariant;
  size?: MacroInputSize;
};

const sizeConfig = {
  full: {
    padding: theme.spacing.padding['5'], // 20px
    fontSize: theme.typography.fontSize['5xl'], // 48px
  },
  half: {
    padding: theme.spacing.padding.base, // 16px
    fontSize: theme.typography.fontSize['4xl'], // 36px
  },
};

const variantColors: Record<MacroInputVariant, string> = {
  default: theme.colors.accent.primary,
  success: theme.colors.status.success,
  warning: theme.colors.status.warning,
  error: theme.colors.status.error,
  info: theme.colors.status.info,
  accent: theme.colors.accent.secondary,
};

const variantBorderColors: Record<MacroInputVariant, string> = {
  default: theme.colors.accent.primary50,
  success: theme.colors.accent.primary50,
  warning: theme.colors.status.warning50,
  error: theme.colors.status.error50,
  info: theme.colors.status.info50,
  accent: theme.colors.accent.secondary20,
};

export function MacroInput({
  label,
  value,
  onChange,
  topRightElement,
  variant = 'default',
  size = 'full',
}: MacroInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const highlightColor = variantColors[variant];
  const borderColor = variantBorderColors[variant];
  const config = sizeConfig[size];

  return (
    <View
      className="overflow-hidden rounded-xl border border-white/10 bg-bg-card"
      style={
        {
          width: size === 'half' ? '47%' : '100%',
          padding: config.padding,
          borderColor: isFocused ? borderColor : theme.colors.background.white10,
          shadowColor: highlightColor,
          shadowOffset: theme.shadowOffset.zero,
          shadowOpacity: theme.shadowOpacity.veryLight,
          shadowRadius: theme.shadows.radius8.shadowRadius,
          elevation: theme.elevation.sm,
        } as any
      }>
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
