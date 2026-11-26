import { Apple, ScanText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { HistoryPickerField } from '@/components/modals/aiHistorySettings';
import { ToggleInput } from '@/components/theme/ToggleInput';
import type { NutritionLogHistoryDays, WorkoutHistoryDays } from '@/constants/settings';
import { useTheme } from '@/hooks/useTheme';

type AiHistoryPickersProps = {
  nutritionLogHistoryDays: NutritionLogHistoryDays;
  onNutritionLogHistoryDaysChange: (value: NutritionLogHistoryDays) => void;
  workoutHistoryDays: WorkoutHistoryDays;
  onWorkoutHistoryDaysChange: (value: WorkoutHistoryDays) => void;
};

/**
 * Shared nutrition-log and workout history window pickers used by both the main AI
 * behavior settings screen and the coach quick-settings modal.
 */
export function AiHistoryPickers({
  nutritionLogHistoryDays,
  onNutritionLogHistoryDaysChange,
  workoutHistoryDays,
  onWorkoutHistoryDaysChange,
}: AiHistoryPickersProps) {
  return (
    <>
      <HistoryPickerField
        kind="nutrition"
        value={nutritionLogHistoryDays}
        onChange={(value) => onNutritionLogHistoryDaysChange(value as NutritionLogHistoryDays)}
      />
      <HistoryPickerField
        kind="workout"
        value={workoutHistoryDays}
        onChange={(value) => onWorkoutHistoryDaysChange(value as WorkoutHistoryDays)}
      />
    </>
  );
}

type AiOcrAndFoundationTogglesProps = {
  /** True when the active resolved provider (`aiProvider`) is `'on-device'`. */
  isOnDevice: boolean;
  useOcrBeforeAi: boolean;
  onUseOcrBeforeAiChange: (value: boolean) => void;
  sendFoundationFoodsToLlm: boolean;
  onSendFoundationFoodsToLlmChange: (value: boolean) => void;
  /** Quick settings hides the OCR row while on-device AI manages OCR implicitly. */
  hideOcrWhenOnDevice?: boolean;
};

/**
 * Shared OCR-before-AI and Foundation Foods toggles for AI settings and coach quick settings.
 * On-device AI forces OCR on and disables Foundation Foods.
 */
export function AiOcrAndFoundationToggles({
  isOnDevice,
  useOcrBeforeAi,
  onUseOcrBeforeAiChange,
  sendFoundationFoodsToLlm,
  onSendFoundationFoodsToLlmChange,
  hideOcrWhenOnDevice = false,
}: AiOcrAndFoundationTogglesProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const items = [
    ...(hideOcrWhenOnDevice && isOnDevice
      ? []
      : [
          {
            key: 'use-ocr-before-ai',
            label: t('settings.aiSettings.useOcrBeforeAi'),
            subtitle: isOnDevice
              ? t('settings.aiSettings.useOcrBeforeAiOnDeviceSubtitle')
              : t('settings.aiSettings.useOcrBeforeAiSubtitle'),
            value: useOcrBeforeAi,
            onValueChange: onUseOcrBeforeAiChange,
            disabled: isOnDevice,
            icon: (
              <View
                style={{
                  width: theme.size['8'],
                  height: theme.size['8'],
                  borderRadius: theme.borderRadius.full / 2,
                  backgroundColor: theme.colors.status.success20,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ScanText size={theme.iconSize.md} color={theme.colors.status.success} />
              </View>
            ),
          },
        ]),
    {
      key: 'send-foundation-foods',
      label: t('settings.aiSettings.sendFoundationFoodsToLlm'),
      subtitle: isOnDevice
        ? t('settings.aiSettings.onDeviceAi.foundationFoodsDisabled')
        : t('settings.aiSettings.sendFoundationFoodsToLlmSubtitle'),
      value: isOnDevice ? false : sendFoundationFoodsToLlm,
      onValueChange: onSendFoundationFoodsToLlmChange,
      disabled: isOnDevice,
      icon: (
        <View
          style={{
            width: theme.size['8'],
            height: theme.size['8'],
            borderRadius: theme.borderRadius.full / 2,
            backgroundColor: theme.colors.accent.primary20,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Apple size={theme.iconSize.md} color={theme.colors.accent.primary} />
        </View>
      ),
    },
  ];

  return <ToggleInput items={items} />;
}
