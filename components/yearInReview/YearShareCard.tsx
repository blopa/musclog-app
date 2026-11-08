import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View, type ViewInstance } from 'react-native';

import { LoggyPose, useLoggyVisible } from '@/components/LoggyPose';
import { POSTER_GROUNDS } from '@/constants/loggyPalette';
import type { Units } from '@/constants/settings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { fitFontSize } from '@/utils/fitText';
import { kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnitI18nKey } from '@/utils/units';
import { macroMassInUnits, massFractionDigits } from '@/utils/yearInReview/foodFigures';
import type { YearShareFields } from '@/utils/yearInReview/shareFields';

/** Fixed logical size, so the captured PNG has the same proportions on every device. */
export const YEAR_SHARE_CARD_WIDTH = 330;
/**
 * 9:16, a story's shape. Seven figures fill four rows, and the third row's right-hand figure has to
 * clear Loggy's raised arm: at 500 the protein (and, before it, the weight) label sat behind him.
 */
export const YEAR_SHARE_CARD_HEIGHT = 587;

const PADDING = 20;
const POSE_HEIGHT = 210;
const YEAR_SIZE = 96;
const STAT_SIZE = 36;
/** Two figures a row, in the width left inside the padding. */
const STAT_COLUMN = (YEAR_SHARE_CARD_WIDTH - PADDING * 2 - 16) / 2;

const ground = POSTER_GROUNDS.yellow;

type Props = {
  captureRef: RefObject<ViewInstance | null>;
  fields: YearShareFields;
  units: Units;
};

function Stat({ label, value }: { label: string; value: string }) {
  const fontSize = fitFontSize(value, STAT_COLUMN, STAT_SIZE);

  return (
    <View style={{ width: STAT_COLUMN }}>
      <Text
        allowFontScaling={false}
        className="font-bold tabular-nums"
        numberOfLines={1}
        style={{ color: ground.ink, fontSize, lineHeight: STAT_SIZE * 1.15 }}
      >
        {value}
      </Text>
      <Text
        allowFontScaling={false}
        className="text-sm font-medium"
        numberOfLines={1}
        style={{ color: ground.ink }}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * The image that gets shared, a poster in the story's colours. It draws exactly what
 * `selectShareFields` hands it: a field the user did not choose is null and is not rendered, so no
 * weight or food figure can appear by accident. Type does not follow the device's font scale,
 * because the image has a fixed size and is read on someone else's screen.
 */
export function YearShareCard({ captureRef, fields, units }: Props) {
  const { t } = useTranslation();
  const showLoggy = useLoggyVisible();
  const { formatGroupedInteger, formatDecimal } = useFormatAppNumber();
  const unit = t(getWeightUnitI18nKey(units));
  const protein =
    fields.proteinGrams !== null ? macroMassInUnits(fields.proteinGrams, units) : null;
  const weightChange =
    fields.weightChangeKg !== null ? kgToDisplay(fields.weightChangeKg, units) : null;

  return (
    <View
      ref={captureRef}
      collapsable={false}
      className="overflow-hidden"
      style={{
        backgroundColor: ground.background,
        height: YEAR_SHARE_CARD_HEIGHT,
        padding: PADDING,
        width: YEAR_SHARE_CARD_WIDTH,
      }}
      testID="year-share-card"
    >
      {showLoggy ? (
        <View style={{ bottom: -4, position: 'absolute', right: -10 }}>
          <LoggyPose appearance="classic" pose="flex" height={POSE_HEIGHT} animated={false} />
        </View>
      ) : null}

      <Text
        allowFontScaling={false}
        className="text-base font-semibold"
        style={{ color: ground.ink }}
      >
        {t('yearInReview.title')}
      </Text>
      <Text
        allowFontScaling={false}
        className="font-bold tabular-nums"
        style={{ color: ground.ink, fontSize: YEAR_SIZE, lineHeight: YEAR_SIZE * 1.1 }}
      >
        {String(fields.year)}
      </Text>

      <View className="mt-2 flex-row flex-wrap" style={{ columnGap: 16, rowGap: 10 }}>
        {fields.sessions !== null ? (
          <Stat
            label={t('yearInReview.share.sessions')}
            value={formatGroupedInteger(fields.sessions)}
          />
        ) : null}
        {fields.activeDays !== null ? (
          <Stat
            label={t('yearInReview.share.activeDays')}
            value={formatGroupedInteger(fields.activeDays)}
          />
        ) : null}
        {fields.totalVolumeKg !== null ? (
          <Stat
            label={`${t('yearInReview.share.volume')} (${unit})`}
            value={formatGroupedInteger(Math.round(kgToDisplay(fields.totalVolumeKg, units)))}
          />
        ) : null}
        {fields.personalRecords !== null ? (
          <Stat
            label={t('yearInReview.share.records')}
            value={formatGroupedInteger(fields.personalRecords)}
          />
        ) : null}
        {fields.mealsLogged !== null ? (
          <Stat
            label={t('yearInReview.share.meals')}
            value={formatGroupedInteger(fields.mealsLogged)}
          />
        ) : null}
        {protein !== null ? (
          <Stat
            label={`${t('yearInReview.share.protein')} (${unit})`}
            value={formatDecimal(protein, massFractionDigits(protein))}
          />
        ) : null}
        {weightChange !== null ? (
          <Stat
            label={`${t('yearInReview.share.weight')} (${unit})`}
            value={`${weightChange < 0 ? '−' : '+'}${formatDecimal(Math.abs(weightChange), 1)}`}
          />
        ) : null}
      </View>

      {fields.topExercise !== null ? (
        <View className="mt-auto" style={{ maxWidth: YEAR_SHARE_CARD_WIDTH * 0.46 }}>
          <Text
            allowFontScaling={false}
            className="text-sm font-medium"
            style={{ color: ground.ink }}
          >
            {t('yearInReview.share.topExercise')}
          </Text>
          <Text
            allowFontScaling={false}
            className="text-base font-semibold"
            numberOfLines={3}
            style={{ color: ground.ink }}
          >
            {fields.topExercise.name}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
