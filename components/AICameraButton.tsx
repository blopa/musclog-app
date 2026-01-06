import { View, Text, Pressable } from 'react-native';
import { Grid3x3 } from 'lucide-react-native';
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
      className="relative flex-1 rounded-2xl border border-emerald-900/30 py-4"
      onPress={onPress}>
      <LinearGradient
        colors={theme.colors.gradients.button}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0 rounded-2xl"
      />
      <View className="flex-row items-center justify-center gap-3">
        <Grid3x3 size={theme.iconSize.md} color={theme.colors.text.primary} />
        <Text className="text-lg font-semibold text-text-primary">
          {t('food.actions.aiCamera')}
        </Text>
      </View>
    </Pressable>
  );
}
