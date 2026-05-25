import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { Button } from '@/components/theme/Button';
import { Slider } from '@/components/theme/Slider';
import { TextInput } from '@/components/theme/TextInput';
import { type MealType } from '@/database/models/NutritionLog';
import { useTheme } from '@/hooks/useTheme';
import { flushLoadingPaint } from '@/utils/flushLoadingPaint';

const SAVE_PRESETS = [25, 50, 75, 100];

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (percentage: number, note?: string) => Promise<void>;
  isLoading?: boolean;
  mealType?: MealType;
};

export function SaveForLaterPortionModal({
  visible,
  onClose,
  onConfirm,
  isLoading = false,
  mealType,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [percentage, setPercentage] = useState(100);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusy = isLoading || isSubmitting;

  useEffect(() => {
    const syncOrReset = () => {
      if (visible) {
        setPercentage(100);
        setNote('');
      } else {
        setIsSubmitting(false);
      }
    };
    syncOrReset();
  }, [visible]);

  const handleConfirm = async () => {
    if (isBusy) {
      return;
    }
    setIsSubmitting(true);
    await flushLoadingPaint();
    try {
      await onConfirm(percentage, note.trim() || undefined);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const remaining = 100 - percentage;

  return (
    <BottomPopUp
      visible={visible}
      onClose={isBusy ? undefined : onClose}
      title={t('food.mealGroup.saveForLater')}
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
            label={t('common.save')}
            variant="gradientCta"
            size="sm"
            width="flex-1"
            onPress={handleConfirm}
            disabled={isBusy}
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
        <View className="flex-row items-center justify-between">
          <Text
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('food.mealGroup.saveForLaterPercentageLabel')}
          </Text>
          <Text
            className="font-bold"
            style={{
              color: theme.colors.accent.primary,
              fontSize: theme.typography.fontSize.sm,
            }}
          >
            {percentage}%
          </Text>
        </View>

        <View className="flex-row gap-2">
          {SAVE_PRESETS.map((preset) => (
            <Pressable
              key={preset}
              className="flex-1 items-center justify-center rounded-xl border py-2"
              style={{
                borderColor:
                  percentage === preset
                    ? theme.colors.accent.primary
                    : theme.colors.background.white10,
                backgroundColor:
                  percentage === preset
                    ? theme.colors.accent.primary10
                    : theme.colors.background.white5,
              }}
              onPress={() => setPercentage(preset)}
            >
              <Text
                className="font-semibold"
                style={{
                  color:
                    percentage === preset
                      ? theme.colors.accent.primary
                      : theme.colors.text.secondary,
                  fontSize: theme.typography.fontSize.sm,
                }}
              >
                {preset}%
              </Text>
            </Pressable>
          ))}
        </View>

        <Slider value={percentage} min={1} max={100} step={1} onChange={setPercentage} />

        <TextInput
          label={t('food.mealGroup.saveForLaterNoteLabel')}
          value={note}
          onChangeText={setNote}
          placeholder={t('food.mealGroup.saveForLaterNotePlaceholder')}
          multiline
          numberOfLines={4}
          editable={!isBusy}
        />

        {remaining > 0 ? (
          <Text className="text-center text-sm" style={{ color: theme.colors.text.secondary }}>
            {t('food.mealGroup.saveForLaterPortionHint', {
              remaining,
              mealType: mealType ? t(`food.meals.${mealType}`) : t('food.mealGroup.meal'),
            })}
          </Text>
        ) : (
          <Text className="text-center text-sm" style={{ color: theme.colors.text.secondary }}>
            {t('food.mealGroup.saveForLaterPortionHintAll')}
          </Text>
        )}
      </View>
      <View pointerEvents="none" style={{ height: theme.spacing.margin['3xl'] }} />
    </BottomPopUp>
  );
}
