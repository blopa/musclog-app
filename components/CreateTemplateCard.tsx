import { View, Text, Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';
import { theme } from '../theme';

type CreateTemplateCardProps = {
  onPress?: () => void;
};

export function CreateTemplateCard({ onPress }: CreateTemplateCardProps) {
  return (
    <Pressable
      className="mt-6 items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-gray-600/40 p-8"
      onPress={onPress}>
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: theme.colors.background.iconDark }}>
        <Plus size={theme.iconSize.md} color={theme.colors.text.secondary} />
      </View>
      <Text className="text-center text-text-secondary">Create from Empty Template</Text>
    </Pressable>
  );
}
