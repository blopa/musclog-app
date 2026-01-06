import { View, Text, Pressable } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { theme } from '../theme';

type WorkoutActionButtonProps = {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
};

export function WorkoutActionButton({ icon: Icon, label, onPress }: WorkoutActionButtonProps) {
  return (
    <Pressable className="flex-1 items-center gap-2" onPress={onPress}>
      <View className="h-20 w-20 items-center justify-center rounded-full border border-border-accent bg-bg-overlay/80">
        <Icon size={theme.iconSize.lg} color={theme.colors.text.secondary} />
      </View>
      <Text className="text-sm font-medium text-text-secondary">{label}</Text>
    </Pressable>
  );
}
