import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { flushLoadingPaint } from '../../utils/flushLoadingPaint';
import { roundToDecimalPlaces } from '../../utils/roundDecimal';
import { BottomPopUp } from '../BottomPopUp';
import { GenericCard } from '../cards/GenericCard';
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
      <View pointerEvents={isBusy ? 'none' : 'auto'} style={{ opacity: isBusy ? 0.65 : 1 }}>
        <ServingSizeSelector value={targetGrams} onChange={setTargetGrams} />
        {previewNutrients ? (
          <View className="mt-4">
            <GenericCard variant="default">
              <View className="gap-2 px-4 py-4">
                <Text className="text-sm text-text-secondary">
                  {t('food.actions.scaleMealPortionPreview')}
                </Text>
                <Text className="text-base font-semibold">
                  <Text className="text-text-secondary">
                    {roundToDecimalPlaces(previewNutrients.calories)} {t('food.common.kcal')}
                  </Text>
                  <Text className="text-text-secondary">{' • '}</Text>
                  <Text style={{ color: theme.colors.macros.protein.text }}>
                    P: {roundToDecimalPlaces(previewNutrients.protein, 1)}g
                  </Text>
                  <Text className="text-text-secondary">{' • '}</Text>
                  <Text style={{ color: theme.colors.macros.carbs.text }}>
                    C: {roundToDecimalPlaces(previewNutrients.carbs, 1)}g
                  </Text>
                  <Text className="text-text-secondary">{' • '}</Text>
                  <Text style={{ color: theme.colors.macros.fat.text }}>
                    F: {roundToDecimalPlaces(previewNutrients.fat, 1)}g
                  </Text>
                </Text>
                {previewNutrients.fiber > 0.05 ? (
                  <Text className="text-sm" style={{ color: theme.colors.macros.fiber.text }}>
                    {t('food.macroValueFormat', {
                      value: roundToDecimalPlaces(previewNutrients.fiber, 1),
                      unit: t('common.units.g'),
                      label: t('food.macros.fiber'),
                    })}
                  </Text>
                ) : null}
              </View>
            </GenericCard>
          </View>
        ) : null}
      </View>
      <View pointerEvents="none" style={{ height: theme.spacing.margin['3xl'] }} />
    </BottomPopUp>
  );
}
