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
}: TestInputProps) {
  return (
    <View className="flex-col gap-2">
      <Text
        className={`ml-1 text-sm font-medium ${focused ? 'text-accent-primary' : 'text-text-secondary'}`}>
        {label}
      </Text>
      <View
        className={`h-14 w-full flex-row items-center rounded-lg border bg-bg-card px-4 ${
          focused ? 'border-2 border-accent-primary/50' : 'border-white/10'
        }`}
        style={
          focused
            ? {
                borderColor: `${theme.colors.accent.primary}80`,
                shadowColor: theme.colors.accent.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 2,
              }
            : {}
        }>
        <RNTextInput
          className="flex-1 border-none bg-transparent p-0 text-text-primary"
          placeholder={placeholder}
          placeholderTextColor={theme.colors.text.tertiary}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          style={{ borderWidth: 0 }}
        />
        {icon && <View className="ml-2">{icon}</View>}
      </View>
    </View>
  );
}
