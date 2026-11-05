import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { ActivityHeatmap } from '@/components/charts/ActivityHeatmap';
import type { Units } from '@/constants/settings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnit } from '@/utils/units';
import type { YearStoryCard } from '@/utils/yearInReview/storyCards';
import { volumeInUnits } from '@/utils/yearInReview/storyCards';
import type { TrainingTimeBucket, YearInReview } from '@/utils/yearInReview/types';

/** Whole keys, so the bucket names are visible to the translation check. */
const BUCKET_KEYS: Record<TrainingTimeBucket, string> = {
  morning: 'yearInReview.trainingTime.buckets.morning',
  afternoon: 'yearInReview.trainingTime.buckets.afternoon',
  evening: 'yearInReview.trainingTime.buckets.evening',
  night: 'yearInReview.trainingTime.buckets.night',
};

const SECONDS_PER_HOUR = 3600;

type Props = {
  card: YearStoryCard;
  review: YearInReview;
  units: Units;
  /** BCP 47 tag for month names, from the app language. */
  locale: string;
};

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="flex-1 justify-center gap-5 px-1 py-6">
      <Text className="text-base font-semibold text-text-secondary">{title}</Text>
      {children}
    </View>
  );
}

function Figure({ value, caption }: { value: string; caption: string }) {
  return (
    <View className="gap-1">
      <Text className="text-4xl font-bold tabular-nums text-text-primary">{value}</Text>
      <Text className="text-lg text-text-secondary">{caption}</Text>
    </View>
  );
}

/**
 * One story card. Each branch is a whole, translated sentence with the numbers already formatted for
 * the account's language; the card does no arithmetic beyond unit conversion.
 */
export function YearStoryCardView({ card, review, units, locale }: Props) {
  const { t } = useTranslation();
  const { formatInteger, formatDecimal } = useFormatAppNumber();

  switch (card.kind) {
    case 'intro':
      return (
        <Frame title={t('yearInReview.intro.title', { year: String(card.year) })}>
          <Text className="text-xl font-bold text-text-primary">
            {t('yearInReview.intro.body')}
          </Text>
        </Frame>
      );

    case 'sessions':
      return (
        <Frame title={t('yearInReview.sessions.title')}>
          <Figure
            value={formatInteger(card.sessions)}
            caption={t('yearInReview.sessions.body', {
              count: card.sessions,
              n: formatInteger(card.sessions),
            })}
          />
          {card.activeDays !== null ? (
            <Text className="text-base text-text-secondary">
              {t('yearInReview.sessions.activeDays', {
                count: card.activeDays,
                n: formatInteger(card.activeDays),
              })}
            </Text>
          ) : null}
        </Frame>
      );

    case 'heatmap':
      return (
        <Frame title={t('yearInReview.heatmap.title')}>
          <ActivityHeatmap
            days={review.workoutDays.map(({ day, value }) => ({ date: day, value }))}
            endDate={new Date(card.year, 11, 31)}
            weeks={53}
            describeDay={({ dateLabel, value }) =>
              `${dateLabel}: ${t('yearInReview.heatmap.describeDay', {
                count: value,
                n: formatInteger(value),
              })}`
            }
            legend={{
              less: t('yearInReview.heatmap.legendLess'),
              more: t('yearInReview.heatmap.legendMore'),
            }}
            scrollLabels={{
              earlier: t('yearInReview.heatmap.scrollEarlier'),
              later: t('yearInReview.heatmap.scrollLater'),
            }}
            summary={t('yearInReview.heatmap.summary')}
          />
        </Frame>
      );

    case 'streak':
      return (
        <Frame title={t('yearInReview.streak.title')}>
          <Figure
            value={formatInteger(card.weeks)}
            caption={t('yearInReview.streak.body', {
              count: card.weeks,
              n: formatInteger(card.weeks),
            })}
          />
        </Frame>
      );

    case 'volume': {
      const display = volumeInUnits(card.totalVolumeKg, units);
      return (
        <Frame title={t('yearInReview.volume.title')}>
          <Figure
            value={`${formatInteger(Math.round(display))} ${getWeightUnit(units)}`}
            caption={t('yearInReview.volume.body')}
          />
        </Frame>
      );
    }

    case 'topExercises':
      return (
        <Frame title={t('yearInReview.topExercises.title')}>
          <View className="gap-3">
            {card.exercises.map((exercise) => (
              <View key={exercise.name} className="flex-row items-baseline justify-between gap-3">
                <Text
                  className="flex-1 text-base font-semibold text-text-primary"
                  numberOfLines={2}
                >
                  {exercise.name}
                </Text>
                <Text className="text-sm tabular-nums text-text-secondary">
                  {t('yearInReview.topExercises.sets', {
                    count: exercise.sets,
                    n: formatInteger(exercise.sets),
                  })}
                </Text>
              </View>
            ))}
          </View>
        </Frame>
      );

    case 'records':
      return (
        <Frame title={t('yearInReview.records.title')}>
          <Figure
            value={formatInteger(card.count)}
            caption={t('yearInReview.records.body', {
              count: card.count,
              n: formatInteger(card.count),
            })}
          />
        </Frame>
      );

    case 'busiestMonth': {
      const monthName = new Intl.DateTimeFormat(locale, { month: 'long' }).format(
        new Date(2000, card.month, 1)
      );
      return (
        <Frame title={t('yearInReview.busiestMonth.title')}>
          <Text className="text-xl font-bold text-text-primary">{monthName}</Text>
          <Text className="text-base text-text-secondary">
            {t('yearInReview.busiestMonth.body', {
              count: card.sessions,
              n: formatInteger(card.sessions),
            })}
          </Text>
        </Frame>
      );
    }

    case 'trainingTime':
      return (
        <Frame title={t('yearInReview.trainingTime.title')}>
          {card.bucket ? (
            <Text className="text-xl font-bold text-text-primary">
              {t(BUCKET_KEYS[card.bucket])}
            </Text>
          ) : null}
          {card.seconds !== null ? (
            <Text className="text-base text-text-secondary">
              {t('yearInReview.trainingTime.hours', {
                n: formatDecimal(card.seconds / SECONDS_PER_HOUR, 1),
              })}
            </Text>
          ) : null}
        </Frame>
      );

    case 'nutrition':
      return (
        <Frame title={t('yearInReview.nutrition.title')}>
          <Text className="text-base text-text-secondary">
            {t('yearInReview.nutrition.body', {
              meals: formatInteger(card.meals),
              days: formatInteger(card.days),
            })}
          </Text>
        </Frame>
      );

    case 'weight': {
      const change = kgToDisplay(card.changeKg, units);
      const amount = formatDecimal(Math.abs(change), 1);
      const unit = getWeightUnit(units);
      let body: string;
      if (Math.round(Math.abs(change) * 10) === 0) {
        body = t('yearInReview.weight.unchanged');
      } else if (change < 0) {
        body = t('yearInReview.weight.lost', { amount, unit });
      } else {
        body = t('yearInReview.weight.gained', { amount, unit });
      }

      return (
        <Frame title={t('yearInReview.weight.title')}>
          <Text className="text-base text-text-secondary">{body}</Text>
        </Frame>
      );
    }

    case 'outro':
      return (
        <Frame title={t('yearInReview.outro.title')}>
          <Text className="text-xl font-bold text-text-primary">
            {t('yearInReview.outro.body')}
          </Text>
        </Frame>
      );
  }
}
