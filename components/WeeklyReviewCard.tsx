import { useRouter } from 'expo-router';
import { CalendarCheck, CalendarClock, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { WEEKLY_REVIEW_ROUTE } from '@/constants/weeklyReviewRoute';
import { useTheme } from '@/hooks/useTheme';
import { useWeeklyReviewStatus } from '@/hooks/useWeeklyReviewStatus';

type WeeklyReviewCardProps = {
  compact?: boolean;
  /**
   * Home's form: a card only while a week is waiting (or half done), otherwise a single
   * line that still names the next review. A permanent card on Home repeated, every day, what the
   * line says.
   */
  quietUntilReady?: boolean;
};

/**
 * The way into Weekly Review from Home, Workouts and Food. It says which week is waiting and
 * whether it is done, so the review is something the user sees rather than a screen they have to
 * remember exists.
 */
export function WeeklyReviewCard({
  compact = false,
  quietUntilReady = false,
}: WeeklyReviewCardProps) {
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

  if (quietUntilReady && !ready) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('weeklyReview.title')}, ${statusLabel}`}
        onPress={() => router.push(WEEKLY_REVIEW_ROUTE)}
        className="min-h-11 flex-row items-center gap-3 active:opacity-70"
        testID="weekly-review-entry"
      >
        <Icon size={theme.iconSize.md} color={theme.colors.text.secondary} />
        <Text className="text-sm font-semibold text-text-primary">{t('weeklyReview.title')}</Text>
        {detail ? (
          <Text className="min-w-0 flex-1 text-sm text-text-secondary" numberOfLines={1}>
            {detail}
          </Text>
        ) : (
          <View className="flex-1" />
        )}
        <ChevronRight size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
      </Pressable>
    );
  }

  // A review that is waiting gets one accent signal, the icon and the status words. It used to
  // stack a border, a tinted fill, a solid icon chip and a solid badge, which made it as loud as
  // the primary actions above it.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('weeklyReview.title')}, ${statusLabel}`}
      onPress={() => router.push(WEEKLY_REVIEW_ROUTE)}
      className={`flex-row items-center gap-3 rounded-card border border-border-light bg-bg-card active:opacity-70 ${compact ? 'min-h-14 px-3 py-2' : 'p-4'}`}
      testID="weekly-review-entry"
    >
      <Icon
        size={compact ? theme.iconSize.md : theme.iconSize.lg}
        color={ready ? theme.colors.accent.primary : theme.colors.text.secondary}
      />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className={`font-semibold text-text-primary ${compact ? 'text-sm' : 'text-base'}`}>
          {t('weeklyReview.title')}
        </Text>
        {/* The status and the week it refers to share one line. */}
        <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
          <Text
            className={`text-xs font-semibold ${ready ? 'text-accent-primary' : 'text-text-secondary'}`}
          >
            {statusLabel}
          </Text>
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
