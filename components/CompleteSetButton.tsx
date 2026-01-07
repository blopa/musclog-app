import { CheckCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StandardButton } from './StandardButton';

type CompleteSetButtonProps = {
  onPress?: () => void;
};

export function CompleteSetButton({ onPress }: CompleteSetButtonProps) {
  const { t } = useTranslation();

  return (
    <StandardButton
      label={t('workoutSession.completeSet')}
      icon={CheckCircle}
      size="lg"
      width="full"
      onPress={onPress}
    />
  );
}
