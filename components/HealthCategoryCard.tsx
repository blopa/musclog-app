import { View, Text } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

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
    <View className="min-w-[45%] flex-1 flex-row items-center gap-3 rounded-2xl border border-white/5 bg-bg-card p-3">
      <View className="rounded-lg p-2" style={{ backgroundColor }}>
        <Icon size={20} color={iconColor} strokeWidth={2} />
      </View>
      <Text className="text-sm font-medium text-white">{label}</Text>
    </View>
  );
}
