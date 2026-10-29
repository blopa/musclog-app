import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { FilterTabs } from '@/components/FilterTabs';
import { Button } from '@/components/theme/Button';
import { Slider } from '@/components/theme/Slider';
import type { MealType } from '@/database/models';
import { useTheme } from '@/hooks/useTheme';
import { localCalendarDayDate } from '@/utils/calendarDate';
import { flushLoadingPaint } from '@/utils/flushLoadingPaint';

import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';

/** Leave every moved/copied item in the meal it is already in. */
export const KEEP_MEAL_TYPES = 'keep';

export type MealTypeTarget = MealType | typeof KEEP_MEAL_TYPES;

type MoveCopyMealModalProps = {
  visible: boolean;
  onClose: () => void;
  mode: 'move' | 'copy' | 'split';
  title?: string;
  sourceMealType: MealType;
  sourceDate: Date;
  isLoading?: boolean;
} & (
  | {
      allowKeepMealTypes?: false;
      onConfirm: (
        targetDate: Date,
        targetMealType: MealType,
        splitPercentage?: number
      ) => Promise<void>;
    }
  | {
      /**
       * Offer "Keep their meals" (selected by default) for a set of items that spans several
       * meals, where one target meal would merge them.
       */
      allowKeepMealTypes: true;
      onConfirm: (
        targetDate: Date,
        targetMealType: MealTypeTarget,
        splitPercentage?: number
      ) => Promise<void>;
    }
);

const SPLIT_PRESETS = [25, 33, 50, 75];

export function MoveCopyMealModal(props: MoveCopyMealModalProps) {
  const {
    visible,
    onClose,
    mode,
    title: customTitle,
    sourceMealType,
    sourceDate,
    isLoading = false,
    allowKeepMealTypes = false,
  } = props;
  const theme = useTheme();
  const { t } = useTranslation();
  const [targetDate, setTargetDate] = useState(() => localCalendarDayDate(sourceDate));
  const initialMealType: MealTypeTarget = allowKeepMealTypes ? KEEP_MEAL_TYPES : sourceMealType;
  const [targetMealType, setTargetMealType] = useState<MealTypeTarget>(initialMealType);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [splitPercentage, setSplitPercentage] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusy = isLoading || isSubmitting;

  useEffect(() => {
    const syncOrReset = () => {
      if (visible) {
        setTargetDate(localCalendarDayDate(sourceDate));
        setTargetMealType(initialMealType);
        setSplitPercentage(50);
      } else {
        setIsSubmitting(false);
      }
    };

    syncOrReset();
  }, [visible, sourceDate, initialMealType]);

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

  const mealTabs: { id: MealTypeTarget; label: string }[] = [
    ...(allowKeepMealTypes
      ? [{ id: KEEP_MEAL_TYPES, label: t('food.actions.keepMealTypes') } as const]
      : []),
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
      const percentage = mode === 'split' ? splitPercentage : undefined;
      if (props.allowKeepMealTypes) {
        await props.onConfirm(targetDate, targetMealType, percentage);
      } else if (targetMealType !== KEEP_MEAL_TYPES) {
        await props.onConfirm(targetDate, targetMealType, percentage);
      }

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

  return (
    <BottomPopUp
      visible={visible}
      onClose={isBusy ? undefined : onClose}
      title={title}
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
        className="gap-5"
        pointerEvents={isBusy ? 'none' : 'auto'}
        style={{ opacity: isBusy ? 0.65 : 1 }}
      >
        {/* Target Date */}
        <DatePickerInput
          label={t('food.actions.targetDate')}
          selectedDate={targetDate}
          onPress={() => setIsDatePickerVisible(true)}
          disabled={isBusy}
          variant="compact"
        />

        {/* Split Percentage (only for split mode) */}
        {mode === 'split' ? (
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text
                className="text-xs font-semibold"
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
            {/* Preset buttons */}
            <View className="flex-row gap-2">
              {SPLIT_PRESETS.map((preset) => (
                <Pressable
                  key={preset}
                  className="flex-1 items-center justify-center rounded-control border py-2"
                  style={{
                    borderColor:
                      splitPercentage === preset
                        ? theme.colors.accent.primary
                        : theme.colors.background.ink10,
                    backgroundColor:
                      splitPercentage === preset
                        ? theme.colors.accent.primary10
                        : theme.colors.background.ink5,
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
            {/* Slider */}
            <Slider
              value={splitPercentage}
              min={1}
              max={99}
              step={1}
              onChange={setSplitPercentage}
            />
          </View>
        ) : null}

        {/* Target Meal Type */}
        <View className="gap-2">
          <Text className="text-xs font-semibold" style={{ color: theme.colors.text.secondary }}>
            {t('food.actions.targetMealType')}
          </Text>
          <FilterTabs
            tabs={mealTabs}
            activeTab={targetMealType}
            onTabChange={(tabId) => setTargetMealType(tabId as MealTypeTarget)}
            showContainer={false}
            scrollViewContentContainerStyle={{ paddingHorizontal: theme.spacing.padding.zero }}
          />
        </View>
      </View>
      <View pointerEvents="none" style={{ height: theme.spacing.margin['3xl'] }} />

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
    </BottomPopUp>
  );
}
