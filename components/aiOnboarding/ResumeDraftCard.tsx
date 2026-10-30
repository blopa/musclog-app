import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';

type ResumeDraftCardProps = {
  onContinue: () => void;
  onStartOver: () => void;
};

/** Offered when an unfinished AI setup is saved: pick it up, or throw it away and begin again. */
export function ResumeDraftCard({ onContinue, onStartOver }: ResumeDraftCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      className="gap-3 rounded-card p-4"
      style={{ backgroundColor: theme.colors.background.card }}
    >
      <View className="gap-1">
        <Text
          className="font-semibold"
          style={{ color: theme.colors.text.primary, fontSize: theme.typography.fontSize.base }}
        >
          {t('aiOnboarding.hub.resumeTitle')}
        </Text>
        <Text
          style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}
        >
          {t('aiOnboarding.hub.resumeBody')}
        </Text>
      </View>
      <View className="flex-row gap-3">
        <Button
          label={t('aiOnboarding.hub.resumeStartOver')}
          variant="outline"
          size="sm"
          width="flex-1"
          onPress={onStartOver}
        />
        <Button
          label={t('aiOnboarding.hub.resumeContinue')}
          variant="accent"
          size="sm"
          width="flex-1"
          onPress={onContinue}
        />
      </View>
    </View>
  );
}
