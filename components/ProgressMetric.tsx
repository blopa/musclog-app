import { View, Text } from 'react-native';
import { theme } from '../theme';

type ProgressMetricProps = {
  value: number;
  unit: string;
  progress: number; // Percentage (0-100)
  bottomText: string;
  formatValue?: (value: number) => string;
};

export function ProgressMetric({
  value,
  unit,
  progress,
  bottomText,
  formatValue = (v) => v.toString(),
}: ProgressMetricProps) {
  return (
    <View className="flex-1">
      <View className="mb-2 flex-row items-baseline gap-1">
        <Text className="text-5xl font-bold text-text-primary">{formatValue(value)}</Text>
        <Text className="text-sm uppercase" style={{ color: theme.colors.overlay.white70 }}>
          {unit}
        </Text>
      </View>
      <View className="mb-2">
        <View
          className="h-2 overflow-hidden rounded-full"
          style={{ backgroundColor: theme.colors.overlay.white30 }}>
          <View className="h-full rounded-full bg-text-primary" style={{ width: `${progress}%` }} />
        </View>
      </View>
      <Text className="text-sm" style={{ color: theme.colors.overlay.white70 }}>
        {bottomText}
      </Text>
    </View>
  );
}
