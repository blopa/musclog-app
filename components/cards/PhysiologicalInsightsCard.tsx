import { Dna, Flame, Minus, TrendingDown, TrendingUp } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type PhysiologicalInsightsCardProps = {
  type: 'estrogen' | 'metabolism' | 'progesterone';
  label: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
};

export function PhysiologicalInsightsCard({
  type,
  label,
  value,
  trend,
}: PhysiologicalInsightsCardProps) {
  const theme = useTheme();
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp size={16} color={theme.colors.status.emerald} />;
      case 'down':
        return <TrendingDown size={16} color={theme.colors.status.error} />;
      default:
        return <Minus size={16} color={theme.colors.text.tertiary} />;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'estrogen':
        return <Dna size={20} color={theme.colors.accent.primary} />;
      case 'metabolism':
        return <Flame size={20} color={theme.colors.accent.primary} />;
      default:
        return null;
    }
  };

  return (
    <View className="flex-1 rounded-2xl border-2 border-white/5 bg-bg-card p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
          {label}
        </Text>
        {getIcon()}
      </View>
      <View className="flex-row items-end justify-between">
        <Text className="text-xl font-black capitalize text-text-primary">{value}</Text>
        {getTrendIcon()}
      </View>
    </View>
  );
}
