import { View, Text, Image, Pressable, ImageSourcePropType } from 'react-native';
import { Archive } from 'lucide-react-native';
import { StartWorkoutButton } from './StartWorkoutButton';

type WorkoutCardProps = {
  name: string;
  lastCompleted: string;
  exerciseCount: number;
  duration: string;
  image: ImageSourcePropType;
  onStart?: () => void;
  onArchive?: () => void;
};

export function WorkoutCard({
  name,
  lastCompleted,
  exerciseCount,
  duration,
  image,
  onStart,
  onArchive,
}: WorkoutCardProps) {
  return (
    <View className="rounded-3xl border border-gray-700/20 bg-[#0f2f27] p-5">
      <View className="mb-4 flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="mb-2 text-sm text-gray-500">Last: {lastCompleted}</Text>
          <Text className="mb-2 text-2xl font-bold text-white">{name}</Text>
          <Text className="text-sm text-gray-400">
            {exerciseCount} Exercises • {duration}
          </Text>
        </View>
        <View className="ml-4 h-20 w-20 overflow-hidden rounded-2xl bg-[#1a3d35]">
          <Image source={image} className="h-full w-full" resizeMode="cover" />
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <Pressable className="flex-row items-center gap-2" onPress={onArchive}>
          <Archive size={16} color="#9ca3af" />
          <Text className="text-sm text-gray-400">Archive</Text>
        </Pressable>
        <StartWorkoutButton variant="secondary" onPress={onStart} />
      </View>
    </View>
  );
}
