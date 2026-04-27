import { ReactNode } from 'react';
import { Text, View } from 'react-native';

type TestSectionProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function TestSection({ title, subtitle, children }: TestSectionProps) {
  return (
    <View className="mb-10 flex-col gap-4 px-6">
      <View>
        <Text className="text-text-primary text-xl font-bold">{title}</Text>
        <Text className="text-text-tertiary mt-1 text-xs font-semibold tracking-wider uppercase">
          {subtitle}
        </Text>
      </View>
      <View className="flex-col gap-6">{children}</View>
    </View>
  );
}

export default TestSection;
