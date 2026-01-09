import React from 'react';
import { View, Text } from 'react-native';
import { Star } from 'lucide-react-native';

export type StatRowProps = {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string | number;
  valueSuffix?: string;
  iconBgColor: string;
  iconColor: string;
  showDivider?: boolean;
  showStarIcon?: boolean;
};

export function WorkoutSummaryStatRow({
  icon: Icon,
  label,
  value,
  valueSuffix,
  iconBgColor,
  iconColor,
  showDivider = true,
  showStarIcon = false,
}: StatRowProps) {
  return (
    <View
      className={`flex-row items-center justify-between ${showDivider ? 'border-b border-white/5 pb-4' : ''}`}>
      <View className="flex-row items-center gap-3">
        <View className="rounded-lg p-2" style={{ backgroundColor: iconBgColor }}>
          <Icon size={20} color={iconColor} />
        </View>
        <Text className="font-medium text-text-secondary">{label}</Text>
      </View>
      <View className="flex-row items-center gap-1">
        {showStarIcon && <Star size={16} color="#fbbf24" fill="#fbbf24" />}
        <Text className="text-2xl font-bold tracking-tight text-text-primary">{value}</Text>
        {valueSuffix && (
          <Text className="text-sm font-normal text-text-tertiary">{valueSuffix}</Text>
        )}
      </View>
    </View>
  );
}
