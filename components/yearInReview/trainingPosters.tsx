import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import {
  BesideLoggy,
  BodyText,
  Hero,
  Poster,
  POSTER_PADDING,
  type PosterCardProps,
  SideStat,
  usePoster,
  useWeightUnitLabel,
} from '@/components/yearInReview/posterKit';
import {
  CalendarLegend,
  YearCalendar,
  YearMonthBars,
  YearShareBar,
  YearWeekStrip,
} from '@/components/yearInReview/YearStoryCharts';
import { MAX_CHROME_FONT_SCALE } from '@/constants/fontScale';
import { LOGGY_PALETTE } from '@/constants/loggyPalette';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { monthNames } from '@/utils/yearInReview/monthNames';
import { volumeInUnits } from '@/utils/yearInReview/storyCards';
import type { TrainingTimeBucket } from '@/utils/yearInReview/types';
import {
  monthlySessions,
  yearCalendarMonths,
  yearWeekStrip,
} from '@/utils/yearInReview/yearCharts';

/** Whole keys, so the bucket names are visible to the translation check. */
const BUCKET_KEYS: Record<TrainingTimeBucket, string> = {
  morning: 'yearInReview.trainingTime.buckets.morning',
  afternoon: 'yearInReview.trainingTime.buckets.afternoon',
  evening: 'yearInReview.trainingTime.buckets.evening',
  night: 'yearInReview.trainingTime.buckets.night',
};

const BUCKET_ORDER: TrainingTimeBucket[] = ['morning', 'afternoon', 'evening', 'night'];

const SECONDS_PER_HOUR = 3600;
/** The calendar page's title and figure, at design scale. */
const CALENDAR_HEADER_HEIGHT = 112;
/** The colour key under the calendar, at design scale. */
const CALENDAR_LEGEND_HEIGHT = 32;
/**
 * The calendar's three marks. They sit on the paper ground, where teal, coral and ink all read,
 * and stay distinct from the empty track.
 */
const CALENDAR_MARK_COLORS = {
  workout: LOGGY_PALETTE.teal,
  food: LOGGY_PALETTE.coral,
  both: LOGGY_PALETTE.ink,
} as const;

export function SessionsPoster({ card }: PosterCardProps<'sessions'>) {
  const { t } = useTranslation();
  const { formatGroupedInteger } = useFormatAppNumber();

  return (
    <Poster title={t('yearInReview.sessions.title')}>
      <Hero
        value={formatGroupedInteger(card.sessions)}
        caption={t('yearInReview.sessions.body', { count: card.sessions })}
      />
      {card.activeDays !== null ? (
        <BesideLoggy>
          <SideStat
            value={formatGroupedInteger(card.activeDays)}
            label={t('yearInReview.share.activeDays')}
          />
        </BesideLoggy>
      ) : null}
    </Poster>
  );
}

export function HeatmapPoster({ card, review, locale }: PosterCardProps<'heatmap'>) {
  const { t } = useTranslation();
  const { formatGroupedInteger } = useFormatAppNumber();
  const { ground, scale, size, innerWidth } = usePoster();
  const days = review.workoutDays.length;
  const caption = t('yearInReview.heatmap.days', { count: days });

  return (
    <Poster title={t('yearInReview.heatmap.title')}>
      <View className="flex-1 justify-between">
        <View className="mt-1 flex-row items-baseline gap-3">
          <Text
            allowFontScaling={false}
            className="font-bold tabular-nums"
            style={{ color: ground.ink, fontSize: 64 * scale }}
          >
            {formatGroupedInteger(days)}
          </Text>
          <Text
            className="min-w-0 flex-1 font-medium"
            maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
            style={{ color: ground.ink, fontSize: 24 * scale }}
          >
            {caption}
          </Text>
        </View>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${formatGroupedInteger(days)} ${caption}`}
        >
          <YearCalendar
            months={yearCalendarMonths(card.year, review.workoutDays, review.nutritionDays)}
            monthLabels={monthNames(locale, 'short')}
            width={innerWidth}
            maxHeight={
              size.height -
              POSTER_PADDING * 2 -
              (CALENDAR_HEADER_HEIGHT + CALENDAR_LEGEND_HEIGHT) * scale
            }
            markColors={CALENDAR_MARK_COLORS}
          />
        </View>
        <CalendarLegend
          entries={[
            {
              label: t('yearInReview.heatmap.legend.workout'),
              color: CALENDAR_MARK_COLORS.workout,
            },
            { label: t('yearInReview.heatmap.legend.food'), color: CALENDAR_MARK_COLORS.food },
            { label: t('yearInReview.heatmap.legend.both'), color: CALENDAR_MARK_COLORS.both },
          ]}
        />
      </View>
    </Poster>
  );
}

export function StreakPoster({ card, review }: PosterCardProps<'streak'>) {
  const { t } = useTranslation();
  const { formatGroupedInteger } = useFormatAppNumber();
  const { scale } = usePoster();

  return (
    <Poster title={t('yearInReview.streak.title')}>
      <Hero
        value={formatGroupedInteger(card.weeks)}
        caption={t('yearInReview.streak.body', { count: card.weeks })}
      />
      <View className="mt-5">
        <YearWeekStrip cells={yearWeekStrip(review.year, review.workoutDays)} height={36 * scale} />
      </View>
    </Poster>
  );
}

export function VolumePoster({ card, review, units }: PosterCardProps<'volume'>) {
  const { t } = useTranslation();
  const { formatGroupedInteger } = useFormatAppNumber();
  const unit = useWeightUnitLabel(units);
  const display = volumeInUnits(card.totalVolumeKg, units);
  const perWorkout = review.sessions ? display / review.sessions : null;

  return (
    <Poster title={t('yearInReview.volume.title')}>
      <Hero value={formatGroupedInteger(Math.round(display))} caption={unit} />
      <BodyText className="mt-3">{t('yearInReview.volume.body')}</BodyText>
      {perWorkout !== null ? (
        <BesideLoggy>
          <SideStat
            value={formatGroupedInteger(Math.round(perWorkout))}
            label={t('yearInReview.volume.perWorkout', { unit })}
          />
        </BesideLoggy>
      ) : null}
    </Poster>
  );
}

export function TopExercisesPoster({ card }: PosterCardProps<'topExercises'>) {
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const most = card.exercises[0]?.sets ?? 1;

  return (
    <Poster title={t('yearInReview.topExercises.title')}>
      <View className="mt-5 gap-5">
        {card.exercises.map((exercise, index) => (
          <YearShareBar
            key={exercise.name}
            label={exercise.name}
            value={t('yearInReview.topExercises.sets', {
              count: exercise.sets,
              n: formatInteger(exercise.sets),
            })}
            share={exercise.sets / most}
            highlighted={index === 0}
          />
        ))}
      </View>
    </Poster>
  );
}

export function RecordsPoster({ card }: PosterCardProps<'records'>) {
  const { t } = useTranslation();
  const { formatGroupedInteger } = useFormatAppNumber();

  return (
    <Poster title={t('yearInReview.records.title')}>
      <Hero
        value={formatGroupedInteger(card.count)}
        caption={t('yearInReview.records.body', { count: card.count })}
      />
    </Poster>
  );
}

export function BusiestMonthPoster({ card, review, locale }: PosterCardProps<'busiestMonth'>) {
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const { scale } = usePoster();

  return (
    <Poster title={t('yearInReview.busiestMonth.title')}>
      <Hero
        value={monthNames(locale, 'long')[card.month]}
        caption={t('yearInReview.busiestMonth.body', {
          count: card.sessions,
          n: formatInteger(card.sessions),
        })}
        maxSize={72}
      />
      <View className="mt-5">
        <YearMonthBars
          counts={monthlySessions(review.workoutDays)}
          labels={monthNames(locale, 'narrow')}
          highlight={card.month}
          height={72 * scale}
        />
      </View>
    </Poster>
  );
}

export function TrainingTimePoster({ card, review }: PosterCardProps<'trainingTime'>) {
  const { t } = useTranslation();
  const { formatInteger, formatDecimal } = useFormatAppNumber();
  const counts = review.trainingTimeCounts;
  const most = counts ? Math.max(...BUCKET_ORDER.map((bucket) => counts[bucket]), 1) : 1;

  return (
    <Poster title={t('yearInReview.trainingTime.title')}>
      {card.bucket ? <Hero value={t(BUCKET_KEYS[card.bucket])} maxSize={64} /> : null}
      {counts ? (
        <View className="mt-3 gap-2">
          {BUCKET_ORDER.map((bucket) => (
            <YearShareBar
              key={bucket}
              label={t(BUCKET_KEYS[bucket])}
              value={formatInteger(counts[bucket])}
              share={counts[bucket] / most}
              highlighted={bucket === card.bucket}
              compact
            />
          ))}
        </View>
      ) : null}
      {card.seconds !== null ? (
        <BesideLoggy>
          <BodyText fontSize={17}>
            {t('yearInReview.trainingTime.hours', {
              n: formatDecimal(card.seconds / SECONDS_PER_HOUR, 1),
            })}
          </BodyText>
        </BesideLoggy>
      ) : null}
    </Poster>
  );
}
