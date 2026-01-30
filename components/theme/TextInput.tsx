import React from 'react';
import { View, Text, TextInput as RNTextInput } from 'react-native';
import { theme } from '../../theme';

type TestInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  focused?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  icon?: React.ReactNode;
  secureTextEntry?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
};

export function TextInput({
  label,
  value,
  onChangeText,
  placeholder,
  focused,
  keyboardType = 'default',
  icon,
  secureTextEntry,
  onFocus,
  onBlur,
}: TestInputProps) {
  return (
    <View className="flex-col gap-2">
      <Text
        className={`ml-1 text-sm font-medium ${focused ? 'text-accent-primary' : 'text-text-secondary'}`}
      >
        {label}
      </Text>
      <View
        className={`h-14 w-full flex-row items-center rounded-lg border-2 bg-bg-card px-4 ${
          focused ? 'border-accent-primary/50' : 'border-white/10'
        }`}
        style={
          focused
            ? {
                borderColor: theme.colors.accent.primary50,
                shadowColor: theme.colors.accent.primary,
                shadowOffset: theme.shadowOffset.zero,
                shadowOpacity: theme.shadowOpacity.light,
                shadowRadius: theme.shadowRadius.md,
                elevation: theme.elevation.sm,
              }
            : {}
        }
      >
        <RNTextInput
          className="flex-1 border-none bg-transparent p-0 pr-10 text-text-primary"
          placeholder={placeholder}
          placeholderTextColor={theme.colors.text.tertiary}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          onFocus={onFocus}
          onBlur={onBlur}
          style={{ borderWidth: theme.borderWidth.none, minWidth: 0 }}
          selectTextOnFocus
        />
        {icon ? <View className="absolute right-4 items-center justify-center">{icon}</View> : null}
      </View>
    </View>
  );
}
