import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import type { MealType } from '@/database/models/NutritionLog';
import { useTheme } from '@/hooks/useTheme';

import { CenteredModal } from './CenteredModal';

type MealInsightsModalProps = {
  visible: boolean;
  onClose: () => void;
  mealType: MealType;
  isLoading: boolean;
  onSubmit: (userRemarks: string) => void;
};

export function MealInsightsModal({
  visible,
  onClose,
  mealType,
  isLoading,
  onSubmit,
}: MealInsightsModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [remarks, setRemarks] = useState('');

  const handleSubmit = () => {
    onSubmit(remarks);
  };

  return (
    <CenteredModal
      visible={visible}
      onClose={onClose}
      isLoading={isLoading}
      title={t('food.mealInsights.title')}
      subtitle={t('food.mealInsights.subtitle', {
        meal: t(`food.meals.${mealType === 'snack' ? 'snacks' : mealType}`),
      })}
    >
      {isLoading ? (
        <View className="items-center gap-4 py-4">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: theme.typography.fontSize.sm,
            }}
          >
            {t('food.mealInsights.loadingText')}
          </Text>
        </View>
      ) : (
        <View className="gap-4">
          <View className="gap-1">
            <Text
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.typography.fontSize.xs,
                fontWeight: '500',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {t('food.mealInsights.contextInputLabel')}
            </Text>
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder={t('food.mealInsights.contextInputPlaceholder')}
              placeholderTextColor={theme.colors.text.tertiary}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: theme.colors.background.overlay,
                borderColor: theme.colors.border.dark,
                borderWidth: theme.borderWidth.thin,
                borderRadius: theme.borderRadius.md,
                color: theme.colors.text.primary,
                fontSize: theme.typography.fontSize.sm,
                padding: theme.spacing.padding.md,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
            />
          </View>
          <Button
            label={t('food.mealInsights.submitButton')}
            variant="accent"
            size="md"
            width="full"
            onPress={handleSubmit}
          />
        </View>
      )}
    </CenteredModal>
  );
}
