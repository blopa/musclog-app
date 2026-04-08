import { LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './GenericCard';

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
  const theme = useTheme();
  return (
    <View className="flex-1 basis-[48%]">
      <GenericCard variant="card" size="sm">
        <View className="flex-row items-center gap-3 p-3">
          <View className="rounded-lg p-2" style={{ backgroundColor }}>
            <Icon
              size={theme.iconSize.lg}
              color={iconColor}
              strokeWidth={theme.strokeWidth.medium}
            />
          </View>
          <Text className="text-sm font-medium text-white">{label}</Text>
        </View>
      </GenericCard>
    </View>
  );
}
