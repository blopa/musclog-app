import React, { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { GenericCard } from '../cards/GenericCard';

interface ProgressChartSectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  rightElement?: ReactNode;
}

export function ProgressChartSection({
  title,
  subtitle,
  children,
  rightElement,
}: ProgressChartSectionProps) {
  return (
    <GenericCard variant="card" containerStyle={{ marginBottom: 16 }}>
      <View style={{ padding: 16 }}>
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-lg font-bold text-text-primary">{title}</Text>
            {subtitle ? <Text className="text-xs text-text-tertiary">{subtitle}</Text> : null}
          </View>
          {rightElement}
        </View>
        {children}
      </View>
    </GenericCard>
  );
}
