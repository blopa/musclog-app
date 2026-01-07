import { CheckCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ConfirmationButton } from './ConfirmationButton';

type CompleteSetButtonProps = {
  onPress?: () => void;
};

export function CompleteSetButton({ onPress }: CompleteSetButtonProps) {
  const { t } = useTranslation();

  return (
    <ConfirmationButton
      label={t('workoutSession.completeSet')}
      icon={CheckCircle}
      size="lg"
      width="full"
      onPress={onPress}
    />
  );
}
