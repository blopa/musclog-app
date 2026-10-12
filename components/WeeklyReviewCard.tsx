import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useWeeklyReviewStatus } from '@/hooks/useWeeklyReviewStatus';

export function WeeklyReviewCard({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const status = useWeeklyReviewStatus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('weeklyReview.title')}
      onPress={() => router.push('/app/nutrition/checkin-list')}
      className={`min-h-12 rounded-xl border border-border-light bg-bg-card ${compact ? 'p-3' : 'p-4'}`}
      testID="weekly-review-entry"
    >
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="font-semibold text-text-primary">{t('weeklyReview.title')}</Text>
        {status ? (
          <Text className="text-sm text-accent-primary">
            {t(status.reviewed ? 'weeklyReview.reviewed' : 'weeklyReview.ready')}
          </Text>
        ) : null}
      </View>
      {!compact && status?.next ? (
        <Text className="mt-1 text-xs text-text-secondary">
          {t('weeklyReview.next', {
            date: new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
              month: 'short',
              day: 'numeric',
            }).format(status.next),
          })}
        </Text>
      ) : null}
    </Pressable>
  );
}
