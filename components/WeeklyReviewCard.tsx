import { useRouter } from 'expo-router';
import { CalendarCheck, CalendarClock, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { useWeeklyReviewStatus } from '@/hooks/useWeeklyReviewStatus';

/**
 * The permanent way into Weekly Review from Home, Workouts and Food. It says which week is waiting
 * and whether it is done, so the review is something the user sees every day rather than a screen
 * they have to remember exists.
 */
export function WeeklyReviewCard({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const status = useWeeklyReviewStatus();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const day = (value: number) =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(value);
  const ready = !!status?.ready;

  let detail = '';
  if (status) {
    detail = ready
      ? t('weeklyReview.cardWeek', { start: day(status.start), end: day(status.end - 1) })
      : t('weeklyReview.next', {
          date: new Intl.DateTimeFormat(locale, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }).format(status.next),
        });
  }
  let statusLabel = t('weeklyReview.upcoming');
  if (ready) {
    statusLabel = t('weeklyReview.ready');
  } else if (status?.reviewed) {
    statusLabel = t('weeklyReview.reviewed');
  }
  const Icon = ready ? CalendarCheck : CalendarClock;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('weeklyReview.title')}, ${statusLabel}`}
      onPress={() => router.push('/app/nutrition/checkin-list')}
      className={`flex-row items-center gap-3 rounded-2xl border ${ready ? 'bg-accent-primary10 border-accent-primary' : 'border-border-light bg-bg-card'} ${compact ? 'min-h-14 px-3 py-2' : 'p-4'}`}
      testID="weekly-review-entry"
    >
      <View
        className={`items-center justify-center rounded-full ${ready ? 'bg-accent-primary' : 'bg-bg-overlay'} ${compact ? 'h-9 w-9' : 'h-11 w-11'}`}
      >
        <Icon
          size={compact ? theme.iconSize.sm : theme.iconSize.md}
          color={ready ? theme.colors.text.onAccent : theme.colors.text.secondary}
        />
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <Text className={`font-bold text-text-primary ${compact ? 'text-sm' : 'text-base'}`}>
          {t('weeklyReview.title')}
        </Text>
        {/* Status as its own pill on the second line: beside the title it ran into it, and in
            compact mode the week it refers to was not shown at all. */}
        <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
          <View
            className={`flex-row items-center rounded-full px-2 py-0.5 ${ready ? 'bg-accent-primary' : 'bg-bg-overlay'}`}
            style={{ gap: 4 }}
          >
            <Text
              className={`text-xs font-semibold ${ready ? 'text-text-on-accent' : 'text-text-secondary'}`}
            >
              {statusLabel}
            </Text>
          </View>
          {detail ? (
            <Text className="text-xs text-text-secondary" numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
        {!compact && ready ? (
          <Text className="text-xs text-text-tertiary">{t('weeklyReview.cardHint')}</Text>
        ) : null}
      </View>
      <ChevronRight size={theme.iconSize.md} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}
