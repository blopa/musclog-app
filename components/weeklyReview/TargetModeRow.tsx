import { useRouter } from 'expo-router';
import { ChevronRight, Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';

import type { NutritionTargetMode } from '@/database/models/NutritionGoal';
import { useTheme } from '@/hooks/useTheme';

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
  const theme = useTheme();
  const router = useRouter();
  const since = effectiveFrom
    ? t('weeklyReview.effective', {
        date: new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
          month: 'short',
          day: 'numeric',
        }).format(effectiveFrom),
      })
    : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t(TARGET_MODE_KEYS[mode])}${since ? `, ${since}` : ''}, ${t('weeklyReview.title')}`}
      onPress={() => router.push('/app/nutrition/checkin-list')}
      className="min-h-11 flex-row items-center gap-2 self-start rounded-full bg-bg-overlay px-3"
      testID="weekly-review-entry"
    >
      <Target size={theme.iconSize.sm} color={theme.colors.accent.primary} />
      <Text className="text-sm font-semibold text-text-primary">{t(TARGET_MODE_KEYS[mode])}</Text>
      {since ? <Text className="text-sm text-text-secondary">· {since}</Text> : null}
      <ChevronRight size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}
