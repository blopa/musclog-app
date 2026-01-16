import { View, Text } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { theme } from '../theme';
import { GenericCard } from './cards/GenericCard';

interface HealthCategoryCardProps {
  icon: LucideIcon;
  label: string;
  backgroundColor: string;
  iconColor: string;
}

export function HealthCategoryCard({
  icon: Icon,
  label,
  backgroundColor,
  iconColor,
}: HealthCategoryCardProps) {
  return (
    <View className="min-w-[45%] flex-1">
      <GenericCard variant="card" size="sm">
        <View className="flex-row items-center gap-3 p-3">
          <View className="rounded-lg p-2" style={{ backgroundColor }}>
            <Icon size={theme.iconSize.lg} color={iconColor} strokeWidth={2} />
          </View>
          <Text className="text-sm font-medium text-white">{label}</Text>
        </View>
      </GenericCard>
    </View>
  );
}
