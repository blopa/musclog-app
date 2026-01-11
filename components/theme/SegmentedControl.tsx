import React from 'react';
import { View, Text, Pressable } from 'react-native';

type Option = {
  label: string;
  value: string;
  icon?: React.ReactNode;
};

type TestSegmentedControlProps = {
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
};

export function SegmentedControl({ options, value, onValueChange }: TestSegmentedControlProps) {
  return (
    <View className="flex-row rounded-lg bg-bg-card p-1">
      {options.map((option) => (
        <Pressable
          key={option.value}
          className={`flex-1 rounded-md py-2 ${value === option.value ? 'bg-bg-cardElevated' : ''}`}
          onPress={() => onValueChange(option.value)}>
          <View className="flex-row items-center justify-center gap-1.5">
            {option.icon}
            <Text
              className={`text-center text-sm font-bold ${
                value === option.value ? 'text-text-primary' : 'text-text-tertiary'
              }`}>
              {option.label}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
