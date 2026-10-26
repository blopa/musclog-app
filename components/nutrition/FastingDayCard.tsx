import { Coffee } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text } from 'react-native';

import { ListRow } from '@/components/theme/ListRow';
import { useTheme } from '@/hooks/useTheme';

type FastingDayCardProps = {
  isFasted: boolean;
  onMark: () => void;
  onUnmark: () => void;
  loading?: boolean;
};

/**
 * Shown in the food diary when the selected day has no logged food and the fasting-day feature
 * is enabled. Lets the user flag the day as an intentional fast (a real 0-kcal day) or clear the
 * flag. Marking is confirmed by the caller via a ConfirmationModal; unmarking is not, so the
 * fasted row says "Unmark" where the chevron would be rather than relying on the row tap alone.
 */
export function FastingDayCard({
  isFasted,
  onMark,
  onUnmark,
  loading = false,
}: FastingDayCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  let trailing;
  if (loading) {
    trailing = <ActivityIndicator size="small" color={theme.colors.text.tertiary} />;
  } else if (isFasted) {
    // A label, not a TextButton: the row is already the button, and a nested one is invalid on web.
    trailing = (
      <Text className="shrink-0 text-sm font-semibold text-accent-primary">
        {t('food.fastingDay.unmarkShort')}
      </Text>
    );
  }

  return (
    <ListRow
      variant="card"
      icon={Coffee}
      iconColor={theme.colors.status.brandBright}
      title={isFasted ? t('food.fastingDay.fastedTitle') : t('food.fastingDay.markButton')}
      subtitle={
        isFasted ? t('food.fastingDay.fastedDescription') : t('food.fastingDay.markDescription')
      }
      accessibilityLabel={isFasted ? t('food.fastingDay.unmarkButton') : undefined}
      trailing={trailing}
      disabled={loading}
      onPress={isFasted ? onUnmark : onMark}
    />
  );
}
