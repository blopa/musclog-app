import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { LoggyPose, useLoggyVisible } from '@/components/LoggyPose';
import { YEAR_STORY_ART } from '@/components/yearInReview/yearStoryArt';
import {
  CalendarLegend,
  YearCalendar,
  YearMonthBars,
  YearShareBar,
  YearWeekStrip,
} from '@/components/yearInReview/YearStoryCharts';
import { MAX_CHROME_FONT_SCALE } from '@/constants/fontScale';
import { LOGGY_PALETTE, POSTER_GROUNDS, type PosterGround } from '@/constants/loggyPalette';
import type { Units } from '@/constants/settings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnitI18nKey } from '@/utils/units';
import {
  chickenBreastsOf,
  macroMassInUnits,
  massFractionDigits,
  proteinComparison,
  type ProteinComparisonId,
} from '@/utils/yearInReview/foodFigures';
import type { YearStoryCard } from '@/utils/yearInReview/storyCards';
import { volumeInUnits } from '@/utils/yearInReview/storyCards';
import { fitFontSize, storyScale } from '@/utils/yearInReview/storyLayout';
import {
  type TrainingTimeBucket,
  YEAR_MEAL_TYPES,
  type YearInReview,
  type YearMealType,
} from '@/utils/yearInReview/types';
import {
  monthlyLoggedDays,
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

/** Whole keys: the diary's own meal names, so the poster says what the diary says. */
const MEAL_LABEL_KEYS: Record<YearMealType, string> = {
  breakfast: 'food.meals.breakfast',
  lunch: 'food.meals.lunch',
  dinner: 'food.meals.dinner',
  snack: 'food.meals.snacks',
  other: 'food.meals.other',
};

/** The one-line joke under the winning meal. Statements about the meal, never about the person. */
const MEAL_CAPTION_KEYS: Record<YearMealType, string> = {
  breakfast: 'yearInReview.favouriteMeal.captions.breakfast',
  lunch: 'yearInReview.favouriteMeal.captions.lunch',
  dinner: 'yearInReview.favouriteMeal.captions.dinner',
  snack: 'yearInReview.favouriteMeal.captions.snack',
  other: 'yearInReview.favouriteMeal.captions.other',
};

const MACRO_LABEL_KEYS = {
  protein: 'yearInReview.macros.protein',
  carbs: 'yearInReview.macros.carbs',
  fat: 'yearInReview.macros.fat',
} as const;

const BUCKET_ORDER: TrainingTimeBucket[] = ['morning', 'afternoon', 'evening', 'night'];

const SECONDS_PER_HOUR = 3600;
const POSTER_PADDING = 24;
const HERO_SIZE = 132;
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
/** The free column beside the mascot, as a share of the poster's width. */
const BESIDE_LOGGY_SHARE = 0.38;
/** How far the mascot hangs past the poster's edge, so it stands in the frame, not on a shelf. */
const POSE_BLEED_RIGHT = 12;
const POSE_BLEED_BOTTOM = 4;

export type PosterSize = { width: number; height: number };

type Props = {
  card: YearStoryCard;
  review: YearInReview;
  units: Units;
  /** BCP 47 tag for month names, from the app language. */
  locale: string;
  size: PosterSize;
};

function monthNames(locale: string, month: 'long' | 'short' | 'narrow'): string[] {
  const format = new Intl.DateTimeFormat(locale, { month });
  return Array.from({ length: 12 }, (_, index) => format.format(new Date(2000, index, 1)));
}

type PosterProps = {
  card: YearStoryCard;
  size: PosterSize;
  title: string;
  /** Height of the mascot as a share of the poster. */
  poseShare?: number;
  children: ReactNode;
};

/** One page of the story: a flat ground, a title, the content, and Loggy standing in the corner. */
function Poster({ card, size, title, poseShare = 0.5, children }: PosterProps) {
  const { ground: groundName, pose } = YEAR_STORY_ART[card.kind];
  const ground = POSTER_GROUNDS[groundName];
  const scale = storyScale(size.height);
  const showLoggy = useLoggyVisible();

  return (
    <View className="flex-1 overflow-hidden" style={{ backgroundColor: ground.background }}>
      {pose && showLoggy ? (
        <Animated.View
          entering={FadeInDown.duration(360)}
          pointerEvents="none"
          style={{ bottom: -POSE_BLEED_BOTTOM, position: 'absolute', right: -POSE_BLEED_RIGHT }}
        >
          <LoggyPose pose={pose} height={size.height * poseShare} />
        </Animated.View>
      ) : null}
      {/* A style, not a class: NativeWind does not reach reanimated's Animated.View. */}
      <Animated.View entering={FadeIn.duration(260)} style={{ flex: 1, padding: POSTER_PADDING }}>
        <Text
          accessibilityRole="header"
          className="font-semibold"
          maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
          style={{ color: ground.ink, fontSize: 22 * scale }}
        >
          {title}
        </Text>
        {children}
      </Animated.View>
    </View>
  );
}

type HeroProps = {
  value: string;
  caption?: string;
  ground: PosterGround;
  size: PosterSize;
  /** Cap for a word rather than a number ("September"). */
  maxSize?: number;
};

/** The one number a poster exists to show. */
function Hero({ value, caption, ground, size, maxSize = HERO_SIZE }: HeroProps) {
  const scale = storyScale(size.height);
  const fontSize = fitFontSize(value, size.width - POSTER_PADDING * 2, maxSize * scale);

  return (
    <View className="mt-2">
      <Text
        allowFontScaling={false}
        className="font-bold tabular-nums"
        numberOfLines={1}
        style={{ color: ground.ink, fontSize, lineHeight: fontSize * 1.12 }}
      >
        {value}
      </Text>
      {caption ? (
        <Text
          className="font-medium"
          maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
          style={{ color: ground.ink, fontSize: 24 * scale, lineHeight: 30 * scale }}
        >
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

type SideStatProps = { value: string; label: string; ground: PosterGround; size: PosterSize };

/** A supporting figure in the free corner beside Loggy. */
function SideStat({ value, label, ground, size }: SideStatProps) {
  const scale = storyScale(size.height);
  const fontSize = fitFontSize(value, size.width * BESIDE_LOGGY_SHARE, 56 * scale);

  return (
    <View>
      <Text
        allowFontScaling={false}
        className="font-bold tabular-nums"
        numberOfLines={1}
        style={{ color: ground.ink, fontSize, lineHeight: fontSize * 1.15 }}
      >
        {value}
      </Text>
      <Text
        className="font-medium"
        maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
        style={{ color: ground.ink, fontSize: 18 * scale, lineHeight: 23 * scale }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Keeps text off the mascot: the bottom-left column beside it (the full width when he is hidden). */
function BesideLoggy({ children, size }: { children: ReactNode; size: PosterSize }) {
  const showLoggy = useLoggyVisible();

  return (
    <View
      className="mt-auto gap-4"
      style={showLoggy ? { maxWidth: size.width * BESIDE_LOGGY_SHARE } : undefined}
    >
      {children}
    </View>
  );
}

/**
 * One story poster. Each branch is whole translated text with the numbers already formatted for the
 * account's language; the only arithmetic here is unit conversion and a per-workout average.
 */
export function YearStoryCardView({ card, review, units, locale, size }: Props) {
  const { t } = useTranslation();
  const { formatInteger, formatGroupedInteger, formatDecimal } = useFormatAppNumber();
  const ground = POSTER_GROUNDS[YEAR_STORY_ART[card.kind].ground];
  const scale = storyScale(size.height);
  const innerWidth = size.width - POSTER_PADDING * 2;
  const bodyStyle = { color: ground.ink, fontSize: 20 * scale, lineHeight: 26 * scale };

  // A `switch` of literal `t()` calls rather than a table of keys: each is a plural base key
  // (`_one`, `_other`, ...) that `check-translations` only recognises inside a call.
  const proteinComparisonText = (id: ProteinComparisonId, count: number): string => {
    const options = { count, n: formatInteger(count) };
    switch (id) {
      case 'wheyBag':
        return t('yearInReview.protein.compare.wheyBag', options);
      case 'cat':
        return t('yearInReview.protein.compare.cat', options);
      case 'bowlingBall':
        return t('yearInReview.protein.compare.bowlingBall', options);
      case 'barbell':
        return t('yearInReview.protein.compare.barbell', options);
    }
  };

  switch (card.kind) {
    case 'intro':
      return (
        <Poster card={card} size={size} title={t('yearInReview.title')} poseShare={0.58}>
          <Hero value={String(card.year)} ground={ground} size={size} />
          <Text
            className="mt-2 font-medium"
            maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
            style={bodyStyle}
          >
            {t('yearInReview.intro.body')}
          </Text>
        </Poster>
      );

    case 'sessions':
      return (
        <Poster card={card} size={size} title={t('yearInReview.sessions.title')}>
          <Hero
            value={formatGroupedInteger(card.sessions)}
            caption={t('yearInReview.sessions.body', { count: card.sessions })}
            ground={ground}
            size={size}
          />
          {card.activeDays !== null ? (
            <BesideLoggy size={size}>
              <SideStat
                value={formatGroupedInteger(card.activeDays)}
                label={t('yearInReview.share.activeDays')}
                ground={ground}
                size={size}
              />
            </BesideLoggy>
          ) : null}
        </Poster>
      );

    case 'heatmap': {
      const days = review.workoutDays.length;
      const caption = t('yearInReview.heatmap.days', { count: days });
      return (
        <Poster card={card} size={size} title={t('yearInReview.heatmap.title')}>
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
                ground={ground}
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
              ground={ground}
              scale={scale}
            />
          </View>
        </Poster>
      );
    }

    case 'streak':
      return (
        <Poster card={card} size={size} title={t('yearInReview.streak.title')} poseShare={0.46}>
          <Hero
            value={formatGroupedInteger(card.weeks)}
            caption={t('yearInReview.streak.body', { count: card.weeks })}
            ground={ground}
            size={size}
          />
          <View className="mt-5">
            <YearWeekStrip
              cells={yearWeekStrip(review.year, review.workoutDays)}
              height={36 * scale}
              ground={ground}
            />
          </View>
        </Poster>
      );

    case 'volume': {
      const display = volumeInUnits(card.totalVolumeKg, units);
      const unit = t(getWeightUnitI18nKey(units));
      const perWorkout = review.sessions ? display / review.sessions : null;
      return (
        <Poster card={card} size={size} title={t('yearInReview.volume.title')} poseShare={0.46}>
          <Hero
            value={formatGroupedInteger(Math.round(display))}
            caption={unit}
            ground={ground}
            size={size}
          />
          <Text
            className="mt-3 font-medium"
            maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
            style={bodyStyle}
          >
            {t('yearInReview.volume.body')}
          </Text>
          {perWorkout !== null ? (
            <BesideLoggy size={size}>
              <SideStat
                value={formatGroupedInteger(Math.round(perWorkout))}
                label={t('yearInReview.volume.perWorkout', { unit })}
                ground={ground}
                size={size}
              />
            </BesideLoggy>
          ) : null}
        </Poster>
      );
    }

    case 'topExercises': {
      const most = card.exercises[0]?.sets ?? 1;
      return (
        <Poster
          card={card}
          size={size}
          title={t('yearInReview.topExercises.title')}
          poseShare={0.46}
        >
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
                ground={ground}
              />
            ))}
          </View>
        </Poster>
      );
    }

    case 'records':
      return (
        <Poster card={card} size={size} title={t('yearInReview.records.title')} poseShare={0.56}>
          <Hero
            value={formatGroupedInteger(card.count)}
            caption={t('yearInReview.records.body', { count: card.count })}
            ground={ground}
            size={size}
          />
        </Poster>
      );

    case 'busiestMonth':
      return (
        <Poster
          card={card}
          size={size}
          title={t('yearInReview.busiestMonth.title')}
          poseShare={0.44}
        >
          <Hero
            value={monthNames(locale, 'long')[card.month]}
            caption={t('yearInReview.busiestMonth.body', {
              count: card.sessions,
              n: formatInteger(card.sessions),
            })}
            ground={ground}
            size={size}
            maxSize={72}
          />
          <View className="mt-5">
            <YearMonthBars
              counts={monthlySessions(review.workoutDays)}
              labels={monthNames(locale, 'narrow')}
              highlight={card.month}
              height={72 * scale}
              ground={ground}
            />
          </View>
        </Poster>
      );

    case 'trainingTime': {
      const counts = review.trainingTimeCounts;
      const most = counts ? Math.max(...BUCKET_ORDER.map((bucket) => counts[bucket]), 1) : 1;
      return (
        <Poster
          card={card}
          size={size}
          title={t('yearInReview.trainingTime.title')}
          poseShare={0.32}
        >
          {card.bucket ? (
            <Hero value={t(BUCKET_KEYS[card.bucket])} ground={ground} size={size} maxSize={64} />
          ) : null}
          {counts ? (
            <View className="mt-3 gap-2">
              {BUCKET_ORDER.map((bucket) => (
                <YearShareBar
                  key={bucket}
                  label={t(BUCKET_KEYS[bucket])}
                  value={formatInteger(counts[bucket])}
                  share={counts[bucket] / most}
                  highlighted={bucket === card.bucket}
                  ground={ground}
                  compact
                />
              ))}
            </View>
          ) : null}
          {card.seconds !== null ? (
            <View className="mt-auto" style={{ maxWidth: size.width * BESIDE_LOGGY_SHARE }}>
              <Text
                className="font-medium"
                maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
                style={{ ...bodyStyle, fontSize: 17 * scale, lineHeight: 22 * scale }}
              >
                {t('yearInReview.trainingTime.hours', {
                  n: formatDecimal(card.seconds / SECONDS_PER_HOUR, 1),
                })}
              </Text>
            </View>
          ) : null}
        </Poster>
      );
    }

    case 'nutrition':
      return (
        <Poster card={card} size={size} title={t('yearInReview.nutrition.title')}>
          <Hero
            value={formatGroupedInteger(card.meals)}
            caption={t('yearInReview.nutrition.meals', { count: card.meals })}
            ground={ground}
            size={size}
          />
          <BesideLoggy size={size}>
            <SideStat
              value={formatGroupedInteger(card.days)}
              label={t('yearInReview.nutrition.days', { count: card.days })}
              ground={ground}
              size={size}
            />
          </BesideLoggy>
        </Poster>
      );

    case 'foodStreak': {
      const logged = monthlyLoggedDays(review.nutritionDays);
      return (
        <Poster card={card} size={size} title={t('yearInReview.foodStreak.title')} poseShare={0.3}>
          <Hero
            value={formatGroupedInteger(card.days)}
            caption={t('yearInReview.foodStreak.body', { count: card.days })}
            ground={ground}
            size={size}
          />
          {/* The caption sits above the bars: below them it runs behind Loggy's head. */}
          <Text
            className="mt-4 font-medium"
            maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
            style={{ ...bodyStyle, fontSize: 16 * scale, lineHeight: 21 * scale }}
          >
            {t('yearInReview.foodStreak.chart')}
          </Text>
          <View className="mt-2">
            <YearMonthBars
              counts={logged}
              labels={monthNames(locale, 'narrow')}
              highlight={logged.indexOf(Math.max(...logged))}
              height={40 * scale}
              ground={ground}
            />
          </View>
        </Poster>
      );
    }

    case 'favouriteMeal': {
      const most = Math.max(...YEAR_MEAL_TYPES.map((type) => card.counts[type]), 1);
      return (
        <Poster
          card={card}
          size={size}
          title={t('yearInReview.favouriteMeal.title')}
          poseShare={0.38}
        >
          <Hero
            value={t(MEAL_LABEL_KEYS[card.mealType])}
            caption={t(MEAL_CAPTION_KEYS[card.mealType])}
            ground={ground}
            size={size}
            maxSize={72}
          />
          <View className="mt-3 gap-2" style={{ maxWidth: size.width * 0.58 }}>
            {/* A type never logged is no row: "Other, 0 days" is clutter, not a figure. */}
            {YEAR_MEAL_TYPES.filter((type) => card.counts[type] > 0).map((type) => (
              <YearShareBar
                key={type}
                label={t(MEAL_LABEL_KEYS[type])}
                value={t('yearInReview.favouriteMeal.days', {
                  count: card.counts[type],
                  n: formatInteger(card.counts[type]),
                })}
                share={card.counts[type] / most}
                highlighted={type === card.mealType}
                ground={ground}
                compact
              />
            ))}
          </View>
        </Poster>
      );
    }

    case 'protein': {
      const display = macroMassInUnits(card.proteinG, units);
      const comparison = proteinComparison(card.proteinG);
      const breasts = chickenBreastsOf(card.proteinG);
      const unit = t(getWeightUnitI18nKey(units));
      return (
        <Poster card={card} size={size} title={t('yearInReview.protein.title')} poseShare={0.38}>
          <Hero
            value={formatDecimal(display, massFractionDigits(display))}
            caption={t('yearInReview.protein.caption', { unit })}
            ground={ground}
            size={size}
          />
          {/* The sum is the point, so say where it comes from: grams of protein, not of food. */}
          <Text
            className="mt-3 font-medium"
            maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
            style={bodyStyle}
          >
            {t('yearInReview.protein.body')}
          </Text>
          {comparison ? (
            <Text
              className="mt-3 font-semibold"
              maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
              // Narrower than the poster: the line otherwise runs into the leaf on Loggy's head.
              style={{ ...bodyStyle, maxWidth: size.width * 0.7 }}
            >
              {proteinComparisonText(comparison.id, comparison.count)}
            </Text>
          ) : null}
          {breasts >= 1 ? (
            <BesideLoggy size={size}>
              <SideStat
                value={formatGroupedInteger(breasts)}
                label={t('yearInReview.protein.chicken', { count: breasts })}
                ground={ground}
                size={size}
              />
            </BesideLoggy>
          ) : null}
        </Poster>
      );
    }

    case 'macros': {
      const unit = t(getWeightUnitI18nKey(units));
      const rows = [
        { key: 'protein', grams: card.proteinG },
        { key: 'carbs', grams: card.carbsG },
        { key: 'fat', grams: card.fatG },
      ] as const;
      const most = Math.max(...rows.map((row) => row.grams), 1);
      return (
        <Poster card={card} size={size} title={t('yearInReview.macros.title')} poseShare={0.4}>
          <View className="mt-5 gap-5" style={{ maxWidth: size.width * 0.66 }}>
            {rows.map((row) => {
              const display = macroMassInUnits(row.grams, units);
              return (
                <YearShareBar
                  key={row.key}
                  label={t(MACRO_LABEL_KEYS[row.key])}
                  value={`${formatDecimal(display, massFractionDigits(display))} ${unit}`}
                  share={row.grams / most}
                  highlighted={row.grams === most}
                  ground={ground}
                />
              );
            })}
          </View>
          <Text
            className="mt-4 font-medium"
            maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
            style={bodyStyle}
          >
            {t('yearInReview.macros.body')}
          </Text>
        </Poster>
      );
    }

    case 'weight': {
      const change = kgToDisplay(card.changeKg, units);
      const unchanged = Math.round(Math.abs(change) * 10) === 0;
      const amount = formatDecimal(Math.abs(change), 1);
      // A plain sign, never "lost" or "gained": the number is the whole statement.
      let value = amount;
      if (!unchanged) {
        value = `${change < 0 ? '−' : '+'}${amount}`;
      }

      return (
        <Poster card={card} size={size} title={t('yearInReview.weight.title')}>
          <Hero
            value={value}
            caption={t(getWeightUnitI18nKey(units))}
            ground={ground}
            size={size}
          />
          <Text
            className="mt-3 font-medium"
            maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
            style={bodyStyle}
          >
            {unchanged ? t('yearInReview.weight.unchanged') : t('yearInReview.weight.caption')}
          </Text>
        </Poster>
      );
    }

    case 'outro':
      return (
        <Poster card={card} size={size} title={t('yearInReview.outro.title')} poseShare={0.38}>
          <Hero value={String(card.year)} ground={ground} size={size} maxSize={88} />
          <View className="mt-2 gap-1">
            {review.sessions !== null ? (
              <RecapLine
                label={t('yearInReview.share.sessions')}
                value={formatGroupedInteger(review.sessions)}
                ground={ground}
                scale={scale}
              />
            ) : null}
            {review.activeDays !== null ? (
              <RecapLine
                label={t('yearInReview.share.activeDays')}
                value={formatGroupedInteger(review.activeDays)}
                ground={ground}
                scale={scale}
              />
            ) : null}
            {review.personalRecords !== null ? (
              <RecapLine
                label={t('yearInReview.share.records')}
                value={formatGroupedInteger(review.personalRecords)}
                ground={ground}
                scale={scale}
              />
            ) : null}
            {review.mealsLogged !== null ? (
              <RecapLine
                label={t('yearInReview.share.meals')}
                value={formatGroupedInteger(review.mealsLogged)}
                ground={ground}
                scale={scale}
              />
            ) : null}
            {review.macroGrams !== null && review.macroGrams.protein > 0 ? (
              <RecapLine
                label={`${t('yearInReview.share.protein')} (${t(getWeightUnitI18nKey(units))})`}
                value={formatGroupedInteger(
                  Math.round(macroMassInUnits(review.macroGrams.protein, units))
                )}
                ground={ground}
                scale={scale}
              />
            ) : null}
          </View>
          <Text
            className="mt-3 font-medium"
            maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
            style={{ ...bodyStyle, fontSize: 17 * scale, lineHeight: 22 * scale }}
          >
            {t('yearInReview.outro.body')}
          </Text>
        </Poster>
      );
  }
}

type RecapLineProps = { label: string; value: string; ground: PosterGround; scale: number };

function RecapLine({ label, value, ground, scale }: RecapLineProps) {
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <Text
        className="min-w-0 flex-1 font-medium"
        maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
        style={{ color: ground.ink, fontSize: 20 * scale }}
      >
        {label}
      </Text>
      <Text
        allowFontScaling={false}
        className="font-bold tabular-nums"
        style={{ color: ground.highlight, fontSize: 28 * scale }}
      >
        {value}
      </Text>
    </View>
  );
}
