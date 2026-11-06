import { Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { Button } from '@/components/theme/Button';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { YearShareCard } from '@/components/yearInReview/YearShareCard';
import type { Units } from '@/constants/settings';
import { useChartCapture } from '@/hooks/useChartCapture';
import { selectShareFields } from '@/utils/yearInReview/shareFields';
import type { YearInReview } from '@/utils/yearInReview/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  review: YearInReview;
  units: Units;
  /** Weight can be shared only when the screen was allowed to read it. */
  weightAvailable: boolean;
};

/**
 * The share step. Both extras are OFF on every open and are not saved: a user who wants them asks
 * for them each time. The card is captured from the same view the user sees.
 */
export function YearShareSheet({ visible, onClose, review, units, weightAvailable }: Props) {
  const { t } = useTranslation();
  const { captureRef, isCapturing, captureAndShare } = useChartCapture();
  const [includeWeight, setIncludeWeight] = useState(false);
  const [includeNutrition, setIncludeNutrition] = useState(false);

  // The sheet stays mounted between opens, so the extras are switched off here, not by unmounting.
  const handleClose = () => {
    setIncludeWeight(false);
    setIncludeNutrition(false);
    onClose();
  };

  const fields = selectShareFields(review, {
    includeWeight: weightAvailable && includeWeight,
    includeNutrition: includeNutrition && review.mealsLogged !== null,
  });

  const toggles = [
    ...(weightAvailable && review.weightChangeKg !== null
      ? [
          {
            key: 'weight',
            label: t('yearInReview.includeWeight'),
            value: includeWeight,
            onValueChange: setIncludeWeight,
          },
        ]
      : []),
    ...(review.mealsLogged !== null
      ? [
          {
            key: 'nutrition',
            label: t('yearInReview.includeNutrition'),
            value: includeNutrition,
            onValueChange: setIncludeNutrition,
          },
        ]
      : []),
  ];

  return (
    <BottomPopUp
      visible={visible}
      onClose={handleClose}
      title={t('yearInReview.shareSheetTitle')}
      // Pinned: the poster fills the sheet, and sharing is the reason it is open.
      footer={
        <Button
          label={t('yearInReview.shareAction')}
          icon={Share2}
          variant="accent"
          size="lg"
          width="full"
          loading={isCapturing}
          onPress={() => void captureAndShare(`year-${review.year}`)}
        />
      }
    >
      <View className="gap-4 pb-4">
        <View className="items-center">
          <View className="overflow-hidden rounded-card">
            <YearShareCard captureRef={captureRef} fields={fields} units={units} />
          </View>
        </View>
        {toggles.length > 0 ? (
          <View className="gap-2">
            <ToggleInput items={toggles.map((toggle) => ({ ...toggle, disabled: isCapturing }))} />
            <Text className="text-sm text-text-secondary">{t('yearInReview.shareHint')}</Text>
          </View>
        ) : null}
      </View>
    </BottomPopUp>
  );
}
