import { View, Text, Pressable } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

type AICameraButtonProps = {
  onPress?: () => void;
};

export function AICameraButton({ onPress }: AICameraButtonProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      className="relative flex-1 rounded-2xl border py-4"
      style={{ borderColor: theme.colors.border.emerald }}
      onPress={onPress}>
      <LinearGradient
        colors={theme.colors.gradients.button}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0 rounded-2xl"
      />
      <View className="flex-row items-center justify-center gap-3">
        <Sparkles size={theme.iconSize.md} color={theme.colors.accent.secondary} />
        <Text className="text-lg font-semibold text-text-primary">
          {t('food.actions.aiCamera')}
        </Text>
      </View>
    </Pressable>
  );
}
