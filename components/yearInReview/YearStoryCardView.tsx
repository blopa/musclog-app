import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import {
  FavouriteMealPoster,
  FoodStreakPoster,
  MacrosPoster,
  NutritionPoster,
  ProteinPoster,
} from '@/components/yearInReview/foodPosters';
import {
  BodyText,
  Hero,
  Poster,
  type PosterCardProps,
  type PosterData,
  PosterScope,
  type PosterSize,
  usePoster,
  useWeightUnitLabel,
} from '@/components/yearInReview/posterKit';
import {
  BusiestMonthPoster,
  HeatmapPoster,
  RecordsPoster,
  SessionsPoster,
  StreakPoster,
  TopExercisesPoster,
  TrainingTimePoster,
  VolumePoster,
} from '@/components/yearInReview/trainingPosters';
import { MAX_CHROME_FONT_SCALE } from '@/constants/fontScale';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { kgToDisplay } from '@/utils/unitConversion';
import { macroMassInUnits } from '@/utils/yearInReview/foodFigures';
import type { YearStoryCard } from '@/utils/yearInReview/storyCards';

function IntroPoster({ card }: PosterCardProps<'intro'>) {
  const { t } = useTranslation();

  return (
    <Poster title={t('yearInReview.title')}>
      <Hero value={String(card.year)} />
      <BodyText className="mt-2">{t('yearInReview.intro.body')}</BodyText>
    </Poster>
  );
}

function WeightPoster({ card, units }: PosterCardProps<'weight'>) {
  const { t } = useTranslation();
  const { formatDecimal } = useFormatAppNumber();
  const unit = useWeightUnitLabel(units);
  const change = kgToDisplay(card.changeKg, units);
  const unchanged = Math.round(Math.abs(change) * 10) === 0;
  const amount = formatDecimal(Math.abs(change), 1);
  // A plain sign, never "lost" or "gained": the number is the whole statement.
  let value = amount;
  if (!unchanged) {
    value = `${change < 0 ? '−' : '+'}${amount}`;
  }

  return (
    <Poster title={t('yearInReview.weight.title')}>
      <Hero value={value} caption={unit} />
      <BodyText className="mt-3">
        {unchanged ? t('yearInReview.weight.unchanged') : t('yearInReview.weight.caption')}
      </BodyText>
    </Poster>
  );
}

function RecapLine({ label, value }: { label: string; value: string }) {
  const { ground, scale } = usePoster();

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

function OutroPoster({ card, review, units }: PosterCardProps<'outro'>) {
  const { t } = useTranslation();
  const { formatGroupedInteger } = useFormatAppNumber();
  const unit = useWeightUnitLabel(units);
  const proteinG = review.macroGrams?.protein ?? 0;
  // A line the review has no figure for is left out, not shown as zero.
  const recap = [
    { label: t('yearInReview.share.sessions'), value: review.sessions },
    { label: t('yearInReview.share.activeDays'), value: review.activeDays },
    { label: t('yearInReview.share.records'), value: review.personalRecords },
    { label: t('yearInReview.share.meals'), value: review.mealsLogged },
    {
      label: `${t('yearInReview.share.protein')} (${unit})`,
      value: proteinG > 0 ? Math.round(macroMassInUnits(proteinG, units)) : null,
    },
  ];

  return (
    <Poster title={t('yearInReview.outro.title')}>
      <Hero value={String(card.year)} maxSize={88} />
      <View className="mt-2 gap-1">
        {recap.map(({ label, value }) =>
          value === null ? null : (
            <RecapLine key={label} label={label} value={formatGroupedInteger(value)} />
          )
        )}
      </View>
      <BodyText className="mt-3" fontSize={17}>
        {t('yearInReview.outro.body')}
      </BodyText>
    </Poster>
  );
}

type Props = PosterData & {
  card: YearStoryCard;
  size: PosterSize;
};

/**
 * One story poster. Each poster is whole translated text with the numbers already formatted for
 * the account's language; the layout (ground, pose, scale) comes from the card's `PosterScope`.
 */
export function YearStoryCardView({ card, size, ...data }: Props) {
  return (
    <PosterScope kind={card.kind} size={size}>
      <PosterByKind card={card} {...data} />
    </PosterScope>
  );
}

/** A `switch`, not a lookup table: each arm hands its poster the card narrowed to its own kind. */
function PosterByKind({ card, ...data }: PosterData & { card: YearStoryCard }) {
  switch (card.kind) {
    case 'intro':
      return <IntroPoster card={card} {...data} />;
    case 'sessions':
      return <SessionsPoster card={card} {...data} />;
    case 'heatmap':
      return <HeatmapPoster card={card} {...data} />;
    case 'streak':
      return <StreakPoster card={card} {...data} />;
    case 'volume':
      return <VolumePoster card={card} {...data} />;
    case 'topExercises':
      return <TopExercisesPoster card={card} {...data} />;
    case 'records':
      return <RecordsPoster card={card} {...data} />;
    case 'busiestMonth':
      return <BusiestMonthPoster card={card} {...data} />;
    case 'trainingTime':
      return <TrainingTimePoster card={card} {...data} />;
    case 'nutrition':
      return <NutritionPoster card={card} {...data} />;
    case 'foodStreak':
      return <FoodStreakPoster card={card} {...data} />;
    case 'favouriteMeal':
      return <FavouriteMealPoster card={card} {...data} />;
    case 'protein':
      return <ProteinPoster card={card} {...data} />;
    case 'macros':
      return <MacrosPoster card={card} {...data} />;
    case 'weight':
      return <WeightPoster card={card} {...data} />;
    case 'outro':
      return <OutroPoster card={card} {...data} />;
  }
}
