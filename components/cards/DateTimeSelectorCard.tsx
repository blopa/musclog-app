import { Calendar, Clock, LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { GenericCard } from './GenericCard';

type DateTimeSelectorCardProps = {
  type: 'date' | 'time';
  value: Date;
  onEdit: () => void;
  label: string;
  formattedValue: string;
  noCard?: boolean; // When true, renders without GenericCard wrapper
};

export function DateTimeSelectorCard({
  type,
  onEdit,
  label,
  formattedValue,
  noCard = false,
}: DateTimeSelectorCardProps) {
  const theme = useTheme();
  const Icon: LucideIcon = type === 'date' ? Calendar : Clock;

  const content = (
    <View className="flex-col gap-2">
      <Text className="ml-1 text-sm font-medium text-text-secondary">{label}</Text>
      <Pressable
        className="h-14 w-full overflow-hidden rounded-lg border-2 border-white/10 bg-bg-card active:opacity-80"
        onPress={onEdit}
      >
        <View className="h-14 flex-row items-center justify-between px-4">
          <View className="min-w-0 flex-1 pr-2">
            <Text className="text-base text-text-primary">{formattedValue}</Text>
          </View>
          <View className="shrink-0 justify-center">
            <Icon size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
          </View>
        </View>
      </Pressable>
    </View>
  );

  if (noCard) {
    return content;
  }

  return (
    <GenericCard variant="card" size="default">
      {content}
    </GenericCard>
  );
}
