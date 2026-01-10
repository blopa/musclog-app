import { Play, ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
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
        size="sm"
        width="flex-1"
        onPress={onPress}
      />
    );
  }

  return (
    <Button
      label={t('startWorkout.start')}
      icon={ArrowRight}
      iconPosition="right"
      variant="secondary"
      size="sm"
      width="auto"
      onPress={onPress}
    />
  );
}
