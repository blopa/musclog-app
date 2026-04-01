import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { flushLoadingPaint } from '../../utils/flushLoadingPaint';
import { BottomPopUp } from '../BottomPopUp';
import { MealNutritionHighlightCard } from '../cards/MealNutritionHighlightCard';
import { ServingSizeSelector } from '../ServingSizeSelector';
import { Button } from '../theme/Button';

export type ScaleMealPortionMealNutrients = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

type ScaleMealPortionModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (totalGrams: number) => Promise<void>;
  initialTotalGrams: number;
  /** Current meal totals at `initialTotalGrams`; used to preview scaled nutrition. */
  mealNutrients: ScaleMealPortionMealNutrients;
  /** Optional: parent can mirror loading; confirm UX uses local state so the spinner paints immediately. */
  isLoading?: boolean;
};

export function ScaleMealPortionModal({
  visible,
  onClose,
  onConfirm,
  initialTotalGrams,
  mealNutrients,
  isLoading = false,
}: ScaleMealPortionModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [targetGrams, setTargetGrams] = useState(initialTotalGrams);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusy = isLoading || isSubmitting;

  const previewNutrients = useMemo(() => {
    if (initialTotalGrams <= 0) {
      return null;
    }
    const ratio = targetGrams / initialTotalGrams;
    return {
      calories: mealNutrients.calories * ratio,
      protein: mealNutrients.protein * ratio,
      carbs: mealNutrients.carbs * ratio,
      fat: mealNutrients.fat * ratio,
      fiber: mealNutrients.fiber * ratio,
    };
  }, [initialTotalGrams, targetGrams, mealNutrients]);

  useEffect(() => {
    if (visible) {
      setTargetGrams(initialTotalGrams);
    } else {
      setIsSubmitting(false);
    }
  }, [visible, initialTotalGrams]);

  const handleConfirm = async () => {
    if (isBusy || targetGrams < 1) {
      return;
    }
    setIsSubmitting(true);
    await flushLoadingPaint();
    try {
      await onConfirm(targetGrams);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isUnchanged = Math.abs(targetGrams - initialTotalGrams) < 0.5;

  return (
    <BottomPopUp
      visible={visible}
      onClose={isBusy ? undefined : onClose}
      title={t('food.actions.scaleMealPortionModalTitle')}
      subtitle={t('food.actions.scaleMealPortionModalSubtitle')}
      footer={
        <View className="flex-row" style={{ gap: theme.spacing.gap.md }}>
          <Button
            label={t('common.cancel')}
            variant="outline"
            size="sm"
            width="flex-1"
            onPress={onClose}
            disabled={isBusy}
          />
          <Button
            label={t('common.confirm')}
            variant="gradientCta"
            size="sm"
            width="flex-1"
            onPress={handleConfirm}
            disabled={isBusy || targetGrams < 1 || isUnchanged}
            loading={isBusy}
          />
        </View>
      }
    >
      <View
        className="gap-4"
        pointerEvents={isBusy ? 'none' : 'auto'}
        style={{ opacity: isBusy ? 0.65 : 1 }}
      >
        {previewNutrients ? (
          <MealNutritionHighlightCard
            caption={t('food.actions.scaleMealPortionPreview')}
            calories={previewNutrients.calories}
            protein={previewNutrients.protein}
            carbs={previewNutrients.carbs}
            fat={previewNutrients.fat}
            fiber={previewNutrients.fiber}
          />
        ) : null}
        <ServingSizeSelector value={targetGrams} onChange={setTargetGrams} />
      </View>
      <View pointerEvents="none" style={{ height: theme.spacing.margin['3xl'] }} />
    </BottomPopUp>
  );
}
