import React, { useState } from 'react';
import { Text, TextInput as RNTextInput, View } from 'react-native';
import { theme } from '../theme';

type CaloriesInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  topRightElement: React.ReactNode;
  highlightColor: string;
};

export function CaloriesInput({
  label,
  value,
  onChange,
  topRightElement,
  highlightColor,
}: CaloriesInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View
      className="overflow-hidden rounded-xl border border-white/10 bg-bg-card p-5"
      style={{
        borderColor: isFocused ? theme.colors.accent.primary50 : theme.colors.background.white10,
        shadowColor: highlightColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 2,
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
        placeholderTextColor={theme.colors.text.tertiary + '50'}
        keyboardType="numeric"
        selectTextOnFocus
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="w-full border-0 bg-transparent p-0 text-5xl font-bold text-text-primary"
        style={{
          fontSize: 48,
          lineHeight: 56,
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
