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
import { DatePickerModal } from './DatePickerModal';

type MoveCopyMealModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (targetDate: Date, targetMealType: MealType) => Promise<void>;
  mode: 'move' | 'copy';
  sourceMealType: MealType;
  sourceDate: Date;
  isLoading?: boolean;
};

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

  const title =
    mode === 'move' ? t('food.actions.moveModalTitle') : t('food.actions.copyModalTitle');

  const mealTabs: { id: MealType; label: string }[] = [
    { id: 'breakfast', label: t('food.meals.breakfast') },
    { id: 'lunch', label: t('food.meals.lunch') },
    { id: 'dinner', label: t('food.meals.dinner') },
    { id: 'snack', label: t('food.meals.snacks') },
    { id: 'other', label: t('food.meals.trackOther') },
  ];

  const handleConfirm = async () => {
    if (isLoading) {
      return;
    }
    await onConfirm(targetDate, targetMealType);
    onClose();
  };

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
              disabled={isLoading}
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
