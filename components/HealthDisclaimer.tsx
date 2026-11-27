import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/**
 * Said wherever the app works out calories or loads for someone: these are estimates, not medical
 * advice, and some people should ask a professional first. No health question is asked for it.
 */
export function HealthDisclaimer({ className }: { className?: string }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Text
      className={className}
      style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.xs }}
    >
      {t('common.healthDisclaimer')}
    </Text>
  );
}
