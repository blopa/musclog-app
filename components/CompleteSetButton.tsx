import { Text, Pressable } from 'react-native';
import { CheckCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

type CompleteSetButtonProps = {
  onPress?: () => void;
};

export function CompleteSetButton({ onPress }: CompleteSetButtonProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      className="w-full flex-row items-center justify-center gap-3 rounded-3xl bg-accent-primary py-5"
      onPress={onPress}>
      <CheckCircle size={theme.iconSize.lg} color={theme.colors.text.black} />
      <Text className="text-text-black text-xl font-bold">{t('workoutSession.completeSet')}</Text>
    </Pressable>
  );
}
