import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';

/**
 * Says that a TDEE was measured over an earlier stretch of tracking (the recent weeks had too
 * little data), and how to refresh it. Shown wherever such a TDEE is shown as a number.
 */
export function PastTdeeWindowNote({
  startMs,
  endMs,
  className = 'text-xs text-text-secondary',
}: {
  startMs: number;
  endMs: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();

  return (
    <Text className={className}>
      {t('progress.pastTdeeWindow', {
        start: format(startMs, 'MMM d, yyyy', { locale }),
        end: format(endMs, 'MMM d, yyyy', { locale }),
      })}
    </Text>
  );
}
