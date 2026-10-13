import { useRouter } from 'expo-router';
import { Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Chip } from '@/components/theme/Chip';
import { WEEKLY_REVIEW_ROUTE } from '@/constants/weeklyReviewRoute';
import type { NutritionTargetMode } from '@/database/models/NutritionGoal';

export const TARGET_MODE_KEYS = {
  manual: 'weeklyReview.modes.manual',
  daily: 'weeklyReview.modes.daily',
  weekly: 'weeklyReview.modes.weekly',
} as const satisfies Record<NutritionTargetMode, string>;

/**
 * Where today's targets come from ("Weekly targets · since Oct 12"), and the way into Weekly Review
 * from Food on the days a review is not due — so the review stays one tap away without a card
 * sitting above the diary every day.
 */
export function TargetModeRow({
  mode,
  effectiveFrom,
}: {
  mode: NutritionTargetMode;
  effectiveFrom?: number;
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const since = effectiveFrom
    ? t('weeklyReview.effective', {
        date: new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
          month: 'short',
          day: 'numeric',
        }).format(effectiveFrom),
      })
    : null;
  const label = t(TARGET_MODE_KEYS[mode]);
  return (
    <View className="self-start">
      <Chip
        variant="solid"
        role="button"
        icon={Target}
        label={since ? `${label} · ${since}` : label}
        accessibilityLabel={`${label}${since ? `, ${since}` : ''}, ${t('weeklyReview.title')}`}
        onPress={() => router.push(WEEKLY_REVIEW_ROUTE)}
        testID="weekly-review-entry"
      />
    </View>
  );
}
