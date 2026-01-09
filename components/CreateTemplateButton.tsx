import { View, Text, Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';
import { theme } from '../theme';

type CreateTemplateCardProps = {
  onPress?: () => void;
};

export function CreateTemplateButton({ onPress }: CreateTemplateCardProps) {
  return (
    <Pressable
      className="w-full items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 active:opacity-80"
      style={{
        borderColor: theme.colors.border.gray600,
        backgroundColor: theme.colors.background.card,
      }}
      onPress={onPress}>
      <View
        className="h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: theme.colors.background.cardElevated }}>
        <Plus size={theme.iconSize.lg} color={theme.colors.text.primary} />
      </View>
      <Text className="text-center text-base font-medium text-text-primary">
        Create from Empty Template
      </Text>
    </Pressable>
  );
}
