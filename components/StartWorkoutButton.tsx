import { Pressable, Text } from 'react-native';
import { Play, ArrowRight } from 'lucide-react-native';

type StartWorkoutButtonProps = {
  variant?: 'primary' | 'secondary';
  onPress?: () => void;
};

export function StartWorkoutButton({ variant = 'primary', onPress }: StartWorkoutButtonProps) {
  if (variant === 'primary') {
    return (
      <Pressable
        className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-[#22c55e] py-4"
        onPress={onPress}>
        <Play size={20} color="#000000" fill="#000000" />
        <Text className="font-bold text-black">Start Workout</Text>
      </Pressable>
    );
  }

  return (
    <Pressable className="flex-row items-center gap-2" onPress={onPress}>
      <Text className="font-semibold text-[#22c55e]">Start</Text>
      <ArrowRight size={20} color="#22c55e" />
    </Pressable>
  );
}
