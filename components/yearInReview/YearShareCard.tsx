import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View, type ViewInstance } from 'react-native';

import type { Units } from '@/constants/settings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnit } from '@/utils/units';
import type { YearShareFields } from '@/utils/yearInReview/shareFields';

/** Fixed logical size, so the captured PNG has the same proportions on every device. */
export const YEAR_SHARE_CARD_WIDTH = 320;
export const YEAR_SHARE_CARD_HEIGHT = 400;

type Props = {
  captureRef: RefObject<ViewInstance | null>;
  fields: YearShareFields;
  units: Units;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <Text className="text-sm text-text-secondary">{label}</Text>
      <Text className="text-base font-semibold tabular-nums text-text-primary">{value}</Text>
    </View>
  );
}

/**
 * The image that gets shared. It draws exactly what `selectShareFields` hands it: a field the user
 * did not choose is null and is not rendered, so no weight or food figure can appear by accident.
 */
export function YearShareCard({ captureRef, fields, units }: Props) {
  const { t } = useTranslation();
  const { formatInteger, formatDecimal } = useFormatAppNumber();

  return (
    <View
      ref={captureRef}
      collapsable={false}
      className="justify-between gap-4 border border-border-light bg-bg-card p-6"
      style={{ width: YEAR_SHARE_CARD_WIDTH, height: YEAR_SHARE_CARD_HEIGHT }}
      testID="year-share-card"
    >
      <View className="gap-1">
        <Text className="text-sm font-semibold text-text-secondary">
          {t('yearInReview.share.brand')}
        </Text>
        <Text className="text-3xl font-bold text-text-primary">{String(fields.year)}</Text>
      </View>

      <View className="gap-3">
        {fields.sessions !== null ? (
          <Stat label={t('yearInReview.share.sessions')} value={formatInteger(fields.sessions)} />
        ) : null}
        {fields.activeDays !== null ? (
          <Stat
            label={t('yearInReview.share.activeDays')}
            value={formatInteger(fields.activeDays)}
          />
        ) : null}
        {fields.totalVolumeKg !== null ? (
          <Stat
            label={t('yearInReview.share.volume')}
            value={`${formatInteger(Math.round(kgToDisplay(fields.totalVolumeKg, units)))} ${getWeightUnit(units)}`}
          />
        ) : null}
        {fields.topExercise !== null ? (
          <Stat label={t('yearInReview.share.topExercise')} value={fields.topExercise.name} />
        ) : null}
        {fields.personalRecords !== null ? (
          <Stat
            label={t('yearInReview.share.records')}
            value={formatInteger(fields.personalRecords)}
          />
        ) : null}
        {fields.mealsLogged !== null ? (
          <Stat label={t('yearInReview.share.meals')} value={formatInteger(fields.mealsLogged)} />
        ) : null}
        {fields.weightChangeKg !== null ? (
          <Stat
            label={t('yearInReview.share.weight')}
            value={`${formatDecimal(Math.abs(kgToDisplay(fields.weightChangeKg, units)), 1)} ${getWeightUnit(units)}`}
          />
        ) : null}
      </View>
    </View>
  );
}
