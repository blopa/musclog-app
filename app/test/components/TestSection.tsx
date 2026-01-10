import React from 'react';
import { View, Text } from 'react-native';

type TestSectionProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function TestSection({ title, subtitle, children }: TestSectionProps) {
  return (
    <View className="mb-10 flex-col gap-4 px-6">
      <View>
        <Text className="text-xl font-bold text-text-primary">{title}</Text>
        <Text className="mt-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          {subtitle}
        </Text>
      </View>
      <View className="flex-col gap-6">{children}</View>
    </View>
  );
}

export default TestSection;
