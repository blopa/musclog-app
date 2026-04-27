import { LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type WorkoutActionButtonProps = {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
};

export function WorkoutActionButton({ icon: Icon, label, onPress }: WorkoutActionButtonProps) {
  const theme = useTheme();
  return (
    <Pressable className="flex-1 items-center gap-2" onPress={onPress}>
      <View className="border-border-accent bg-bg-overlay/80 h-20 w-20 items-center justify-center rounded-full border">
        <Icon size={theme.iconSize.lg} color={theme.colors.text.secondary} />
      </View>
      <Text className="text-text-secondary text-sm font-medium">{label}</Text>
    </Pressable>
  );
}
