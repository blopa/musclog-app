import { format } from 'date-fns';
import { Calendar } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import type { MealType } from '../../database/models';
import { useTheme } from '../../hooks/useTheme';
import { BottomPopUp } from '../BottomPopUp';
import { FilterTabs } from '../FilterTabs';
import { Button } from '../theme/Button';
import { Slider } from '../theme/Slider';
import { DatePickerModal } from './DatePickerModal';

type MoveCopyMealModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (
    targetDate: Date,
    targetMealType: MealType,
    splitPercentage?: number
  ) => Promise<void>;
  mode: 'move' | 'copy' | 'split';
  sourceMealType: MealType;
  sourceDate: Date;
  isLoading?: boolean;
};

const SPLIT_PRESETS = [25, 33, 50, 75];

export function MoveCopyMealModal({
  visible,
  onClose,
  onConfirm,
  mode,
  sourceMealType,
  sourceDate,
  isLoading = false,
}: MoveCopyMealModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [targetDate, setTargetDate] = useState(sourceDate);
  const [targetMealType, setTargetMealType] = useState<MealType>(sourceMealType);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [splitPercentage, setSplitPercentage] = useState(50);

  const title =
    mode === 'move'
      ? t('food.actions.moveModalTitle')
      : mode === 'copy'
        ? t('food.actions.copyModalTitle')
        : t('food.actions.splitModalTitle');

  const mealTabs: { id: MealType; label: string }[] = [
    { id: 'breakfast', label: t('food.meals.breakfast') },
    { id: 'lunch', label: t('food.meals.lunch') },
    { id: 'dinner', label: t('food.meals.dinner') },
    { id: 'snack', label: t('food.meals.snacks') },
    { id: 'other', label: t('food.meals.other') },
  ];

  const handleConfirm = async () => {
    if (isLoading) {
      return;
    }
    await onConfirm(targetDate, targetMealType, mode === 'split' ? splitPercentage : undefined);
    onClose();
  };

  const handlePresetPress = (preset: number) => {
    setSplitPercentage(preset);
  };

  const isConfirmDisabled =
    isLoading || (mode === 'split' && (splitPercentage < 1 || splitPercentage > 99));

  return (
    <>
      <BottomPopUp
        visible={visible}
        onClose={onClose}
        title={title}
        footer={
          <View className="flex-row" style={{ gap: theme.spacing.gap.md }}>
            <Button
              label={t('common.cancel')}
              variant="outline"
              size="sm"
              width="flex-1"
              onPress={onClose}
              disabled={isLoading}
            />
            <Button
              label={t('common.confirm')}
              variant="gradientCta"
              size="sm"
              width="flex-1"
              onPress={handleConfirm}
              disabled={isConfirmDisabled}
              loading={isLoading}
            />
          </View>
        }
      >
        <View className="gap-5">
          {/* Target Date */}
          <View className="gap-2">
            <Text
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: theme.colors.text.secondary }}
            >
              {t('food.actions.targetDate')}
            </Text>
            <Pressable
              className="flex-row items-center gap-3 rounded-xl border p-3"
              style={{
                borderColor: theme.colors.background.white10,
                backgroundColor: theme.colors.background.white5,
              }}
              onPress={() => setIsDatePickerVisible(true)}
            >
              <Calendar size={theme.iconSize.sm} color={theme.colors.accent.primary} />
              <Text
                className="flex-1 font-medium text-text-primary"
                style={{ fontSize: theme.typography.fontSize.sm }}
              >
                {format(targetDate, 'EEEE, MMM d, yyyy')}
              </Text>
            </Pressable>
          </View>

          {/* Split Percentage (only for split mode) */}
          {mode === 'split' ? (
            <View className="gap-2">
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
              {/* Preset buttons */}
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
        <View pointerEvents="none" style={{ height: theme.spacing.margin['3xl'] }} />
      </BottomPopUp>

      {isDatePickerVisible ? (
        <DatePickerModal
          visible={isDatePickerVisible}
          onClose={() => setIsDatePickerVisible(false)}
          selectedDate={targetDate}
          onDateSelect={(date) => {
            setTargetDate(date);
            setIsDatePickerVisible(false);
          }}
        />
      ) : null}
    </>
  );
}
