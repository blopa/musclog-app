import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { FoodNutritionSectionCard } from '@/components/cards/FoodNutritionSectionCard';
import { FilterTabs } from '@/components/FilterTabs';
import { Button } from '@/components/theme/Button';
import { QuoteCallout } from '@/components/theme/QuoteCallout';
import { Slider } from '@/components/theme/Slider';
import type { MealType } from '@/database/models';
import { useTheme } from '@/hooks/useTheme';
import { localCalendarDayDate } from '@/utils/calendarDate';
import { flushLoadingPaint } from '@/utils/flushLoadingPaint';

import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';
import { FullScreenModal } from './FullScreenModal';

type TrackSavedForLaterFoodMealModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (
    targetDate: Date,
    targetMealType: MealType,
    splitPercentage?: number
  ) => Promise<void>;
  mode: 'move' | 'copy' | 'split';
  title?: string;
  note?: string;
  sourceMealType: MealType;
  sourceDate: Date;
  isLoading?: boolean;
  mealName?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

const SPLIT_PRESETS = [25, 33, 50, 75];

export function TrackSavedForLaterFoodMealModal({
  visible,
  onClose,
  onConfirm,
  mode,
  title: customTitle,
  note,
  sourceMealType,
  sourceDate,
  isLoading = false,
  mealName,
  calories = 0,
  protein = 0,
  carbs = 0,
  fat = 0,
}: TrackSavedForLaterFoodMealModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [targetDate, setTargetDate] = useState(() => localCalendarDayDate(sourceDate));
  const [targetMealType, setTargetMealType] = useState<MealType>(sourceMealType);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [splitPercentage, setSplitPercentage] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusy = isLoading || isSubmitting;

  useEffect(() => {
    const syncOrReset = () => {
      if (visible) {
        setTargetDate(localCalendarDayDate(sourceDate));
        setTargetMealType(sourceMealType);
        setSplitPercentage(50);
      } else {
        setIsSubmitting(false);
      }
    };
    syncOrReset();
  }, [visible, sourceDate, sourceMealType]);

  useEffect(() => {
    if (!visible) {
      const reset = () => {
        setIsDatePickerVisible(false);
      };
      reset();
    }
  }, [visible]);

  let title = customTitle;
  if (!title) {
    if (mode === 'move') {
      title = t('food.actions.moveModalTitle');
    } else if (mode === 'copy') {
      title = t('food.actions.copyModalTitle');
    } else {
      title = t('food.actions.splitModalTitle');
    }
  }

  const mealTabs: { id: MealType; label: string }[] = [
    { id: 'breakfast', label: t('food.meals.breakfast') },
    { id: 'lunch', label: t('food.meals.lunch') },
    { id: 'dinner', label: t('food.meals.dinner') },
    { id: 'snack', label: t('food.meals.snacks') },
    { id: 'other', label: t('food.meals.other') },
  ];

  const handleConfirm = async () => {
    if (isBusy) {
      return;
    }
    setIsSubmitting(true);
    await flushLoadingPaint();
    try {
      await onConfirm(targetDate, targetMealType, mode === 'split' ? splitPercentage : undefined);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePresetPress = (preset: number) => {
    setSplitPercentage(preset);
  };

  const isConfirmDisabled =
    isBusy || (mode === 'split' && (splitPercentage < 1 || splitPercentage > 99));

  const hasNutrition = calories > 0 || protein > 0 || carbs > 0 || fat > 0;

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      closable={!isBusy}
      title={title ?? ''}
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
            disabled={isConfirmDisabled}
            loading={isBusy}
          />
        </View>
      }
    >
      <View
        className="px-4"
        pointerEvents={isBusy ? 'none' : 'auto'}
        style={{ opacity: isBusy ? 0.65 : 1 }}
      >
        {hasNutrition ? (
          <FoodNutritionSectionCard
            food={{
              name: mealName || title || '',
              category: '',
              calories,
              protein,
              carbs,
              fat,
            }}
            canEdit={false}
            mode="meal"
            nutritionalData={{ fiber: 0, saturatedFat: 0, sodium: 0 }}
            servingSize={1}
            servingBasis="per_serving"
            isLoadingDetails={false}
          />
        ) : null}

        {note ? (
          <View className="mt-2">
            <QuoteCallout text={note} />
          </View>
        ) : null}

        <View className="mt-6">
          <DatePickerInput
            label={t('food.actions.targetDate')}
            selectedDate={targetDate}
            onPress={() => setIsDatePickerVisible(true)}
            disabled={isBusy}
            variant="compact"
          />
        </View>

        {mode === 'split' ? (
          <View className="mt-6 gap-2">
            <View className="flex-row items-center justify-between">
              <Text
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: theme.colors.text.secondary }}
              >
                {t('food.actions.splitPercentage')}
              </Text>
              <Text
                className="font-bold"
                style={{
                  color: theme.colors.accent.primary,
                  fontSize: theme.typography.fontSize.sm,
                }}
              >
                {splitPercentage}%
              </Text>
            </View>
            <View className="flex-row gap-2">
              {SPLIT_PRESETS.map((preset) => (
                <Pressable
                  key={preset}
                  className="flex-1 items-center justify-center rounded-xl border py-2"
                  style={{
                    borderColor:
                      splitPercentage === preset
                        ? theme.colors.accent.primary
                        : theme.colors.background.white10,
                    backgroundColor:
                      splitPercentage === preset
                        ? theme.colors.accent.primary10
                        : theme.colors.background.white5,
                  }}
                  onPress={() => handlePresetPress(preset)}
                >
                  <Text
                    className="font-semibold"
                    style={{
                      color:
                        splitPercentage === preset
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
            <Slider
              value={splitPercentage}
              min={1}
              max={99}
              step={1}
              onChange={setSplitPercentage}
            />
          </View>
        ) : null}

        <View className="mt-6 gap-2">
          <Text
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('food.actions.targetMealType')}
          </Text>
          <FilterTabs
            tabs={mealTabs}
            activeTab={targetMealType}
            onTabChange={(tabId) => setTargetMealType(tabId as MealType)}
            showContainer={false}
            scrollViewContentContainerStyle={{ paddingHorizontal: theme.spacing.padding.zero }}
          />
        </View>
      </View>

      {isDatePickerVisible ? (
        <DatePickerModal
          visible={isDatePickerVisible}
          onClose={() => setIsDatePickerVisible(false)}
          selectedDate={targetDate}
          onDateSelect={(date) => {
            setTargetDate(localCalendarDayDate(date));
            setIsDatePickerVisible(false);
          }}
        />
      ) : null}
    </FullScreenModal>
  );
}
