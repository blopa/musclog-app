import { View, Text, Image, Pressable, ImageSourcePropType } from 'react-native';
import { MoreVertical, Clock } from 'lucide-react-native';
import { StartWorkoutButton } from './StartWorkoutButton';

type FeaturedWorkoutCardProps = {
  name: string;
  lastCompleted: string;
  exerciseCount: number;
  duration: string;
  image: ImageSourcePropType;
  onStart?: () => void;
  onMore?: () => void;
};

export function FeaturedWorkoutCard({
  name,
  lastCompleted,
  exerciseCount,
  duration,
  image,
  onStart,
  onMore,
}: FeaturedWorkoutCardProps) {
  return (
    <View className="rounded-3xl border-2 border-blue-500/40 bg-[#0f2f27] p-5">
      <View className="mb-4 flex-row items-start justify-between">
        <View className="flex-1">
          <View className="mb-3 inline-flex flex-row items-center gap-1.5 self-start rounded-full bg-[#22c55e]/20 px-3 py-1">
            <Clock size={14} color="#22c55e" />
            <Text className="text-xs font-bold uppercase text-[#22c55e]">{lastCompleted}</Text>
          </View>
          <Text className="mb-2 text-2xl font-bold text-white">{name}</Text>
          <Text className="text-sm text-gray-400">
            {exerciseCount} Exercises • {duration}
          </Text>
        </View>
        <View className="ml-4 h-20 w-20 overflow-hidden rounded-2xl bg-[#1a3d35]">
          <Image source={image} className="h-full w-full opacity-70" resizeMode="cover" />
        </View>
      </View>

      <View className="flex-row gap-3">
        <StartWorkoutButton variant="primary" onPress={onStart} />
        <Pressable
          className="w-14 items-center justify-center rounded-2xl bg-[#1a3d35]"
          onPress={onMore}>
          <MoreVertical size={20} color="#9ca3af" />
        </Pressable>
      </View>
    </View>
  );
}
