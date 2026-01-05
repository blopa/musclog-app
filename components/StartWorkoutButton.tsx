import { Pressable, Text } from 'react-native';
import { Play, ArrowRight } from 'lucide-react-native';
import { theme } from '../theme';

type StartWorkoutButtonProps = {
  variant?: 'primary' | 'secondary';
  onPress?: () => void;
};

export function StartWorkoutButton({ variant = 'primary', onPress }: StartWorkoutButtonProps) {
  if (variant === 'primary') {
    return (
      <Pressable
        className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-accent-primary py-4"
        onPress={onPress}>
        <Play size={theme.iconSize.sm} color="#000000" fill="#000000" />
        <Text className="font-bold text-black">Start Workout</Text>
      </Pressable>
    );
  }

  return (
    <Pressable className="flex-row items-center gap-2" onPress={onPress}>
      <Text className="font-semibold text-accent-primary">Start</Text>
      <ArrowRight size={theme.iconSize.sm} color={theme.colors.accent.primary} />
    </Pressable>
  );
}
