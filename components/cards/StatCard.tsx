import { TrendingUp } from 'lucide-react-native';
import { ComponentType, ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './GenericCard';

type StatCardProps = {
  title: string | ReactNode;
  value: string;
  unit?: string;
  change?: string;
  changeType?: 'positive' | 'warning' | 'negative';
  icon: ComponentType<{ size: number; color: string }>;
  iconColor: string;
};

export function StatCard({
  title,
  value,
  unit,
  change,
  changeType,
  icon: Icon,
  iconColor,
}: StatCardProps) {
  const theme = useTheme();
  const getChangeColor = () => {
    if (changeType === 'positive') {
      return theme.colors.accent.primary;
    }

    if (changeType === 'negative') {
      return theme.colors.status.error;
    }

    return theme.colors.status.warning;
  };

  const changeColor = getChangeColor();

  return (
    <GenericCard variant="default" size="sm">
      <View className="p-4">
        <View className="mb-2 flex-row items-start justify-between">
          <Text className="text-sm text-text-secondary">{title}</Text>
          <Icon size={theme.iconSize.sm} color={iconColor} />
        </View>
        <View className="mb-1 flex-row items-baseline gap-1">
          <Text className="text-3xl font-bold text-text-primary">{value}</Text>
          {unit ? <Text className="text-lg text-text-secondary">{unit}</Text> : null}
        </View>
        {change ? (
          <View className="flex-row items-center gap-1">
            <TrendingUp size={theme.iconSize.xs} color={changeColor} />
            <Text className="text-xs font-medium" style={{ color: changeColor }}>
              {change}
            </Text>
          </View>
        ) : null}
      </View>
    </GenericCard>
  );
}
