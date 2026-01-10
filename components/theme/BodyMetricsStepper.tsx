import { View, Text, Pressable } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { theme } from '../../theme';

type BodyMetricCardProps = {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  sublabel: string;
  value: number;
  unit: string;
  unitLabel: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
};

export function BodyMetricsStepper({
  icon: Icon,
  label,
  sublabel,
  value,
  unit,
  unitLabel,
  min,
  max,
  step = 1,
  onChange,
}: BodyMetricCardProps) {
  const handleDecrement = () => {
    onChange(Math.max(min, value - step));
  };

  const handleIncrement = () => {
    onChange(Math.min(max, value + step));
  };

  return (
    <View
      className="rounded-xl border bg-bg-card p-5"
      style={{ borderColor: theme.colors.border.emerald }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: theme.colors.accent.primary10 }}>
            <Icon size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </View>
          <View>
            <Text className="font-semibold text-text-primary">{label}</Text>
            <Text className="text-xs text-text-secondary">{sublabel}</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full border"
            style={{
              backgroundColor: theme.colors.accent.primary10,
              borderColor: `${theme.colors.accent.primary}33`,
            }}
            onPress={handleDecrement}>
            <Minus size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </Pressable>
          <View className="w-16 items-center">
            <Text className="text-xl font-bold text-text-primary">
              {unit === 'index' ? value.toFixed(1) : value}
            </Text>
            <Text className="text-xs text-text-secondary">{unitLabel}</Text>
          </View>
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full border"
            style={{
              backgroundColor: theme.colors.accent.primary10,
              borderColor: `${theme.colors.accent.primary}33`,
            }}
            onPress={handleIncrement}>
            <Plus size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
