import { View, Text, Image, Pressable, ImageSourcePropType } from 'react-native';
import { Flame } from 'lucide-react-native';
import { CircularArrow } from './CircularArrow';

type RecentWorkoutsCardProps = {
  name: string;
  date: string;
  duration: string;
  calories: number;
  prs: number | null;
  image: ImageSourcePropType;
  imageBgColor: string;
  onPress?: () => void;
};

export function RecentWorkoutsCard({
  name,
  date,
  duration,
  calories,
  prs,
  image,
  imageBgColor,
  onPress,
}: RecentWorkoutsCardProps) {
  return (
    <Pressable
      className="flex-row items-center gap-4 rounded-2xl bg-[#1a2f2a] p-4"
      onPress={onPress}>
      <View
        className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl"
        style={{ backgroundColor: imageBgColor }}>
        <Image source={image} className="h-full w-full" resizeMode="cover" />
      </View>
      <View className="flex-1">
        <Text className="mb-1 text-lg font-bold text-white">{name}</Text>
        <Text className="mb-2 text-sm text-gray-400">
          {date} • {duration}
        </Text>
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center gap-1 rounded-full bg-[#0f251f] px-2.5 py-1">
            <Flame size={14} color="#f97316" />
            <Text className="text-xs font-medium text-orange-500">{calories}</Text>
          </View>
          {prs !== null && (
            <View className="flex-row items-center gap-1 rounded-full bg-[#0f251f] px-2.5 py-1">
              <Text className="text-xs">💪</Text>
              <Text className="text-xs font-medium text-[#22c55e]">{prs} PRS</Text>
            </View>
          )}
        </View>
      </View>
      <CircularArrow />
    </Pressable>
  );
}
