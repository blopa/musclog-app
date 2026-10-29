import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { FilterTabs } from '@/components/FilterTabs';
import { getMealTypeOptions } from '@/components/nutrition/mealTypeOptions';
import { Button } from '@/components/theme/Button';
import { TextInput } from '@/components/theme/TextInput';
import type { MealType } from '@/database/models/NutritionLog';
import { useTheme } from '@/hooks/useTheme';
import { flushLoadingPaint } from '@/utils/flushLoadingPaint';

type CombineIntoMealModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Resolves when the logs are grouped; the sheet stays open (name intact) if it throws. */
  onConfirm: (mealName: string, mealType: MealType) => Promise<void>;
  initialMealType: MealType;
  itemCount: number;
};

/**
 * Name the diary items being combined into one meal card, and pick the meal it goes in —
 * the diary groups cards by meal type, so a combined meal has exactly one.
 *
 * Mounted only while open, so each opening starts from a blank name and `initialMealType`.
 */
export function CombineIntoMealModal({
  visible,
  onClose,
  onConfirm,
  initialMealType,
  itemCount,
}: CombineIntoMealModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [mealName, setMealName] = useState('');
  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedName = mealName.trim();
  const mealTabs = getMealTypeOptions(theme, t).map(({ id, label }) => ({ id, label }));

  const handleConfirm = async () => {
    if (isSubmitting || !trimmedName) {
      return;
    }

    setIsSubmitting(true);
    await flushLoadingPaint();
    try {
      await onConfirm(trimmedName, mealType);
      onClose();
    } catch {
      // The caller reports the failure; keep the sheet open so the name is not lost.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomPopUp
      visible={visible}
      onClose={isSubmitting ? undefined : onClose}
      title={t('food.selection.combineTitle')}
      subtitle={t('food.selection.combineSubtitle', { count: itemCount })}
      footer={
        <View className="flex-row" style={{ gap: theme.spacing.gap.md }}>
          <Button
            label={t('common.cancel')}
            variant="outline"
            size="sm"
            width="flex-1"
            onPress={onClose}
            disabled={isSubmitting}
          />
          <Button
            label={t('food.selection.combineConfirm')}
            variant="accent"
            size="sm"
            width="flex-1"
            onPress={handleConfirm}
            disabled={isSubmitting || !trimmedName}
            loading={isSubmitting}
          />
        </View>
      }
    >
      <View className="gap-5" pointerEvents={isSubmitting ? 'none' : 'auto'}>
        <TextInput
          label={t('food.selection.combineNameLabel')}
          value={mealName}
          onChangeText={setMealName}
          placeholder={t('food.selection.combineNamePlaceholder')}
          autoCapitalize="sentences"
          maxLength={80}
          required
        />
        <View className="gap-2">
          <Text className="text-xs font-semibold" style={{ color: theme.colors.text.secondary }}>
            {t('food.actions.targetMealType')}
          </Text>
          <FilterTabs
            tabs={mealTabs}
            activeTab={mealType}
            onTabChange={(tabId) => setMealType(tabId as MealType)}
            showContainer={false}
            scrollViewContentContainerStyle={{ paddingHorizontal: theme.spacing.padding.zero }}
          />
        </View>
      </View>
      <View pointerEvents="none" style={{ height: theme.spacing.margin['3xl'] }} />
    </BottomPopUp>
  );
}
