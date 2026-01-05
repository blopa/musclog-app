import { View, Text, Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';

type CreateTemplateCardProps = {
  onPress?: () => void;
};

export function CreateTemplateCard({ onPress }: CreateTemplateCardProps) {
  return (
    <Pressable
      className="mt-6 items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-gray-600/40 p-8"
      onPress={onPress}>
      <View className="h-12 w-12 items-center justify-center rounded-full bg-[#1a3d35]">
        <Plus size={24} color="#9ca3af" />
      </View>
      <Text className="text-center text-gray-400">Create from Empty Template</Text>
    </Pressable>
  );
}
