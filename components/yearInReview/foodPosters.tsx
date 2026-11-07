import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  BesideLoggy,
  BodyText,
  Hero,
  Poster,
  type PosterCardProps,
  SideStat,
  useLoggyColumn,
  usePoster,
  useWeightUnitLabel,
} from '@/components/yearInReview/posterKit';
import { YearMonthBars, YearShareBar } from '@/components/yearInReview/YearStoryCharts';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import {
  chickenBreastsOf,
  macroMassInUnits,
  massFractionDigits,
  proteinComparison,
  type ProteinComparisonId,
} from '@/utils/yearInReview/foodFigures';
import { monthNames } from '@/utils/yearInReview/monthNames';
import { YEAR_MEAL_TYPES, type YearMealType } from '@/utils/yearInReview/types';
import { monthlyLoggedDays } from '@/utils/yearInReview/yearCharts';

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

/** The meal bars' column beside the mascot, as a share of the poster's width. */
const MEAL_BARS_SHARE = 0.58;
/** The protein comparison's column: wider, but short of the leaf on Loggy's head. */
const PROTEIN_LINE_SHARE = 0.7;
const MACRO_BARS_SHARE = 0.66;

export function NutritionPoster({ card }: PosterCardProps<'nutrition'>) {
  const { t } = useTranslation();
  const { formatGroupedInteger } = useFormatAppNumber();

  return (
    <Poster title={t('yearInReview.nutrition.title')}>
      <Hero
        value={formatGroupedInteger(card.meals)}
        caption={t('yearInReview.nutrition.meals', { count: card.meals })}
      />
      <BesideLoggy>
        <SideStat
          value={formatGroupedInteger(card.days)}
          label={t('yearInReview.nutrition.days', { count: card.days })}
        />
      </BesideLoggy>
    </Poster>
  );
}

export function FoodStreakPoster({ card, review, locale }: PosterCardProps<'foodStreak'>) {
  const { t } = useTranslation();
  const { formatGroupedInteger } = useFormatAppNumber();
  const { scale } = usePoster();
  const logged = monthlyLoggedDays(review.nutritionDays);

  return (
    <Poster title={t('yearInReview.foodStreak.title')}>
      <Hero
        value={formatGroupedInteger(card.days)}
        caption={t('yearInReview.foodStreak.body', { count: card.days })}
      />
      {/* The caption sits above the bars: below them it runs behind Loggy's head. */}
      <BodyText className="mt-4" fontSize={16}>
        {t('yearInReview.foodStreak.chart')}
      </BodyText>
      <View className="mt-2">
        <YearMonthBars
          counts={logged}
          labels={monthNames(locale, 'narrow')}
          highlight={logged.indexOf(Math.max(...logged))}
          height={40 * scale}
        />
      </View>
    </Poster>
  );
}

export function FavouriteMealPoster({ card }: PosterCardProps<'favouriteMeal'>) {
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const column = useLoggyColumn(MEAL_BARS_SHARE);
  const most = Math.max(...YEAR_MEAL_TYPES.map((type) => card.counts[type]), 1);

  return (
    <Poster title={t('yearInReview.favouriteMeal.title')}>
      <Hero
        value={t(MEAL_LABEL_KEYS[card.mealType])}
        caption={t(MEAL_CAPTION_KEYS[card.mealType])}
        maxSize={72}
      />
      <View className="mt-3 gap-2" style={column}>
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
            compact
          />
        ))}
      </View>
    </Poster>
  );
}

export function ProteinPoster({ card, units }: PosterCardProps<'protein'>) {
  const { t } = useTranslation();
  const { formatInteger, formatGroupedInteger, formatDecimal } = useFormatAppNumber();
  const unit = useWeightUnitLabel(units);
  const column = useLoggyColumn(PROTEIN_LINE_SHARE);
  const display = macroMassInUnits(card.proteinG, units);
  const comparison = proteinComparison(card.proteinG);
  const breasts = chickenBreastsOf(card.proteinG);

  // A `switch` of literal `t()` calls rather than a table of keys: each is a plural base key
  // (`_one`, `_other`, ...) that `check-translations` only recognises inside a call.
  const comparisonText = (id: ProteinComparisonId, count: number): string => {
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

  return (
    <Poster title={t('yearInReview.protein.title')}>
      <Hero
        value={formatDecimal(display, massFractionDigits(display))}
        caption={t('yearInReview.protein.caption', { unit })}
      />
      {/* The sum is the point, so say where it comes from: grams of protein, not of food. */}
      <BodyText className="mt-3">{t('yearInReview.protein.body')}</BodyText>
      {comparison ? (
        <BodyText className="mt-3" semibold style={column}>
          {comparisonText(comparison.id, comparison.count)}
        </BodyText>
      ) : null}
      {breasts >= 1 ? (
        <BesideLoggy>
          <SideStat
            value={formatGroupedInteger(breasts)}
            label={t('yearInReview.protein.chicken', { count: breasts })}
          />
        </BesideLoggy>
      ) : null}
    </Poster>
  );
}

export function MacrosPoster({ card, units }: PosterCardProps<'macros'>) {
  const { t } = useTranslation();
  const { formatDecimal } = useFormatAppNumber();
  const unit = useWeightUnitLabel(units);
  const column = useLoggyColumn(MACRO_BARS_SHARE);
  const rows = [
    { key: 'protein', grams: card.proteinG },
    { key: 'carbs', grams: card.carbsG },
    { key: 'fat', grams: card.fatG },
  ] as const;
  const most = Math.max(...rows.map((row) => row.grams), 1);

  return (
    <Poster title={t('yearInReview.macros.title')}>
      <View className="mt-5 gap-5" style={column}>
        {rows.map((row) => {
          const display = macroMassInUnits(row.grams, units);
          return (
            <YearShareBar
              key={row.key}
              label={t(MACRO_LABEL_KEYS[row.key])}
              value={`${formatDecimal(display, massFractionDigits(display))} ${unit}`}
              share={row.grams / most}
              highlighted={row.grams === most}
            />
          );
        })}
      </View>
      <BodyText className="mt-4">{t('yearInReview.macros.body')}</BodyText>
    </Poster>
  );
}
