import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import type { NutritionEntry } from '@/utils/coachAI';
import { calculateNutritionTotals, mealTypeToString } from '@/utils/nutritionAI';

import { FullScreenModal } from './FullScreenModal';

type NutritionConfirmationModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (entries: NutritionEntry[]) => void;
  entries: NutritionEntry[];
  isLoading?: boolean;
};

// TODO: improve UI, remove mocked data and implement usage of this component
export function NutritionConfirmationModal({
  visible,
  onClose,
  onConfirm,
  entries,
  isLoading = false,
}: NutritionConfirmationModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatRoundedDecimal } = useFormatAppNumber();
  const insets = useSafeAreaInsets();

  const totals = useMemo(() => calculateNutritionTotals(entries), [entries]);

  const handleConfirm = useCallback(() => {
    onConfirm(entries);
  }, [entries, onConfirm]);

  const renderNutritionEntry = ({ item, index }: { item: NutritionEntry; index: number }) => (
    <View
      key={index}
      className="mb-3 rounded-lg p-4"
      style={{ backgroundColor: theme.colors.background.card }}
    >
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="flex-1 text-sm font-semibold text-text-primary">{item.productTitle}</Text>
        <Text className="text-xs text-text-secondary">{mealTypeToString(item.mealType)}</Text>
      </View>

      <View className="space-y-1">
        <View className="flex-row justify-between">
          <Text className="text-xs text-text-secondary">{t('nutrition.calories')}:</Text>
          <Text className="text-xs font-medium text-text-primary">
            {formatRoundedDecimal(item.calories, 2)} kcal
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-xs text-text-secondary">{t('nutrition.protein')}:</Text>
          <Text className="text-xs font-medium text-text-primary">
            {/*TODO: use i18n*/}
            {formatRoundedDecimal(item.protein, 2)}g
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-xs text-text-secondary">{t('nutrition.carbs')}:</Text>
          <Text className="text-xs font-medium text-text-primary">
            {/*TODO: use i18n*/}
            {formatRoundedDecimal(item.carbs, 2)}g
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-xs text-text-secondary">{t('nutrition.fat')}:</Text>
          <Text className="text-xs font-medium text-text-primary">
            {/*TODO: use i18n*/}
            {formatRoundedDecimal(item.fat, 2)}g
          </Text>
        </View>
        {item.fiber ? (
          <View className="flex-row justify-between">
            <Text className="text-xs text-text-secondary">{t('nutrition.fiber')}:</Text>
            <Text className="text-xs font-medium text-text-primary">
              {/*TODO: use i18n*/}
              {formatRoundedDecimal(item.fiber, 2)}g
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('nutrition.review')}
      scrollable={false}
      closable={!isLoading}
    >
      <ScrollView className="flex-1 px-4 py-4">
        {/* Summary */}
        <View
          className="mb-6 rounded-lg p-4"
          style={{ backgroundColor: theme.colors.background.card }}
        >
          <Text className="mb-3 font-semibold text-text-primary">{t('nutrition.dailyTotals')}</Text>
          <View className="space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-sm text-text-secondary">
                {t('common.labelWithColon', { label: t('nutrition.calories') })}
              </Text>
              <Text className="text-sm font-semibold text-text-primary">
                {formatRoundedDecimal(totals.totalCalories, 2)} kcal
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-text-secondary">
                {t('common.labelWithColon', { label: t('nutrition.protein') })}
              </Text>
              <Text className="text-sm font-semibold text-text-primary">
                {/*TODO: use i18n*/}
                {formatRoundedDecimal(totals.totalProtein, 2)}g
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-text-secondary">
                {t('common.labelWithColon', { label: t('nutrition.carbs') })}
              </Text>
              <Text className="text-sm font-semibold text-text-primary">
                {/*TODO: use i18n*/}
                {formatRoundedDecimal(totals.totalCarbs, 2)}g
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-text-secondary">
                {t('common.labelWithColon', { label: t('nutrition.fat') })}
              </Text>
              <Text className="text-sm font-semibold text-text-primary">
                {/*TODO: use i18n*/}
                {formatRoundedDecimal(totals.totalFat, 2)}g
              </Text>
            </View>
          </View>
        </View>

        {/* Entry Count */}
        <Text className="mb-4 text-xs text-text-secondary">
          {t('common.labelColonValue', {
            label: t('nutrition.entriesCount'),
            value: String(entries.length),
          })}
        </Text>

        {/* Entry List */}
        <FlatList
          data={entries}
          renderItem={renderNutritionEntry}
          scrollEnabled={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </ScrollView>

      {/* Action Buttons */}
      <View
        className="border-t px-4 py-4"
        style={{ borderColor: theme.colors.border.light, paddingBottom: insets.bottom + 16 }}
      >
        <Pressable
          onPress={handleConfirm}
          disabled={isLoading || entries.length === 0}
          className="mb-2 rounded-lg px-4 py-3"
          style={{
            backgroundColor: theme.colors.accent.primary,
            opacity: isLoading || entries.length === 0 ? 0.5 : 1,
          }}
        >
          <Text className="text-center font-semibold" style={{ color: theme.colors.text.black }}>
            {t('nutrition.confirmAndSave')}
          </Text>
        </Pressable>

        <Pressable
          onPress={onClose}
          disabled={isLoading}
          className="rounded-lg border px-4 py-3"
          style={{
            borderColor: theme.colors.border.light,
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          <Text className="text-center font-semibold text-text-primary">{t('common.cancel')}</Text>
        </Pressable>
      </View>
    </FullScreenModal>
  );
}
