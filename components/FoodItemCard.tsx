import { View, Text, Image, Pressable, ImageSourcePropType } from 'react-native';
import { MoreVertical } from 'lucide-react-native';

type FoodItemCardProps = {
  name: string;
  description: string;
  calories: number;
  image: ImageSourcePropType;
  onMorePress?: () => void;
};

export function FoodItemCard({
  name,
  description,
  calories,
  image,
  onMorePress,
}: FoodItemCardProps) {
  return (
    <View className="flex-row items-center gap-4 rounded-2xl border border-gray-800/50 bg-[#141a17] p-4">
      <View className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-gray-700">
        <Image source={image} className="h-full w-full" resizeMode="cover" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="mb-1 text-lg font-semibold text-white">{name}</Text>
        <Text className="truncate text-sm text-gray-400">{description}</Text>
      </View>
      <View className="flex-shrink-0 items-end">
        <Text className="text-2xl font-bold text-emerald-400">{calories}</Text>
        <Text className="text-xs text-gray-400">kcal</Text>
      </View>
      <Pressable className="flex-shrink-0" onPress={onMorePress}>
        <MoreVertical size={20} color="#9ca3af" />
      </Pressable>
    </View>
  );
}
