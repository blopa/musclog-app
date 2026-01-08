import { Pressable, Text } from 'react-native';
import { Play, ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { Button } from './theme/Button';

type StartWorkoutButtonProps = {
  variant?: 'primary' | 'secondary';
  onPress?: () => void;
};

export function StartWorkoutButton({ variant = 'primary', onPress }: StartWorkoutButtonProps) {
  const { t } = useTranslation();

  if (variant === 'primary') {
    return (
      <Button
        label={t('startWorkout.label')}
        icon={Play}
        size="md"
        width="flex-1"
        onPress={onPress}
      />
    );
  }

  return (
    <Pressable className="flex-row items-center gap-2" onPress={onPress}>
      <Text className="font-semibold text-accent-primary">{t('startWorkout.start')}</Text>
      <ArrowRight size={theme.iconSize.sm} color={theme.colors.accent.primary} />
    </Pressable>
  );
}
