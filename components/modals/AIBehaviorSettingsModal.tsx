import { Apple, ChevronRight, Dumbbell, ScanText, Settings2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Text, View } from 'react-native';

import { ThinkingLevelPicker } from '@/components/ai/ThinkingLevelPicker';
import { CoachPersonaPicker } from '@/components/coach/CoachPersonaPicker';
import NewNumericalInput from '@/components/theme/NewNumericalInput';
import { SectionLabel } from '@/components/theme/SectionLabel';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { useDebouncedSettings } from '@/hooks/useDebouncedSettings';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { AI_IMAGE_TIER_ORDER, type AiImageTier } from '@/utils/aiImagePlan';

import { AiCustomPromptsModal } from './AiCustomPromptsModal';
import { HistoryPickerField } from './aiHistorySettings';
import { FullScreenModal } from './FullScreenModal';

/** One whole key per photo quality tier (label and what it means), so the translation check sees each. */
export const AI_IMAGE_TIER_KEYS: Record<AiImageTier, { label: string; hint: string }> = {
  low: {
    label: 'settings.aiSettings.photoQuality.tier.low.label',
    hint: 'settings.aiSettings.photoQuality.tier.low.hint',
  },
  medium: {
    label: 'settings.aiSettings.photoQuality.tier.medium.label',
    hint: 'settings.aiSettings.photoQuality.tier.medium.hint',
  },
  high: {
    label: 'settings.aiSettings.photoQuality.tier.high.label',
    hint: 'settings.aiSettings.photoQuality.tier.high.hint',
  },
  max: {
    label: 'settings.aiSettings.photoQuality.tier.max.label',
    hint: 'settings.aiSettings.photoQuality.tier.max.hint',
  },
};

type AIBehaviorSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * How the AI behaves once a provider is chosen: daily insights, how hard it thinks, what it
 * remembers, how photos are prepared, the coach's personality and custom prompts. Which provider
 * answers (keys, models, Musclog Iron, on-device) is `AISettingsModal`.
 */
export function AIBehaviorSettingsModal({ visible, onClose }: AIBehaviorSettingsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [isCustomPromptsVisible, setIsCustomPromptsVisible] = useState(false);
  const { aiImageQuality, aiProvider } = useSettings();

  const {
    dailyNutritionInsights: debouncedDailyNutritionInsights,
    workoutInsights: debouncedWorkoutInsights,
    useOcrBeforeAi: debouncedUseOcrBeforeAi,
    useOnDeviceAi: debouncedUseOnDeviceAi,
    sendFoundationFoodsToLlm: debouncedSendFoundationFoodsToLlm,
    thinkingLevel: debouncedThinkingLevel,
    handleDailyNutritionInsightsChange,
    handleWorkoutInsightsChange,
    handleUseOcrBeforeAiChange,
    handleSendFoundationFoodsToLlmChange,
    handleThinkingLevelChange,
    maxAiMemories: debouncedMaxAiMemories,
    handleMaxAiMemoriesChange,
    nutritionLogHistoryDays: debouncedNutritionLogHistoryDays,
    handleNutritionLogHistoryDaysChange,
    workoutHistoryDays: debouncedWorkoutHistoryDays,
    handleWorkoutHistoryDaysChange,
    flushAllPendingChanges,
  } = useDebouncedSettings(500);

  // Flush pending settings changes when the modal closes.
  useEffect(() => {
    if (!visible) {
      flushAllPendingChanges();
    }
  }, [visible, flushAllPendingChanges]);

  const insightsItems = [
    {
      key: 'nutrition-insights',
      label: t('settings.aiSettings.dailyNutritionInsights'),
      subtitle: t('settings.aiSettings.dailyNutritionInsightsSubtitle'),
      value: debouncedDailyNutritionInsights,
      onValueChange: handleDailyNutritionInsightsChange,
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
    {
      key: 'workout-insights',
      label: t('settings.aiSettings.workoutInsights'),
      subtitle: t('settings.aiSettings.workoutInsightsSubtitle'),
      value: debouncedWorkoutInsights,
      onValueChange: handleWorkoutInsightsChange,
      icon: (
        <View
          style={{
            width: theme.size['8'],
            height: theme.size['8'],
            borderRadius: theme.borderRadius.full / 2,
            backgroundColor: theme.colors.status.warning10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Dumbbell size={theme.iconSize.md} color={theme.colors.status.warning} />
        </View>
      ),
    },
  ];

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={t('settings.aiBehavior.title')}>
      <View className="gap-6 px-4 py-6" style={{ minHeight: '100%' }}>
        {/* How hard it thinks comes first: it decides how many requests every other feature makes. */}
        <ThinkingLevelPicker
          value={debouncedThinkingLevel}
          onChange={handleThinkingLevelChange}
          provider={aiProvider}
        />

        {/* Insights & Alerts Section */}
        <View>
          <SectionLabel className="mb-2 px-1">
            {t('settings.aiSettings.insightsAlerts')}
          </SectionLabel>
          <ToggleInput items={insightsItems} />
        </View>

        {/* Memory Settings Section */}
        <View>
          <SectionLabel className="mb-2 px-1">
            {t('settings.aiSettings.memorySettings')}
          </SectionLabel>
          <View className="gap-3">
            <View
              className="rounded-card border bg-bg-card p-4"
              style={{
                borderColor: theme.colors.border.light,
                borderWidth: theme.borderWidth.thin,
              }}
            >
              <NewNumericalInput
                label={t('settings.aiSettings.maxAiMemories')}
                value={debouncedMaxAiMemories || 50}
                onChange={handleMaxAiMemoriesChange}
                min={1}
              />
              <Text className="mt-3 text-xs text-text-secondary">
                {t('settings.aiSettings.maxAiMemoriesSubtitle')}
              </Text>
            </View>
            <HistoryPickerField
              kind="nutrition"
              value={debouncedNutritionLogHistoryDays ?? 'none'}
              onChange={handleNutritionLogHistoryDaysChange}
            />
            <HistoryPickerField
              kind="workout"
              value={debouncedWorkoutHistoryDays ?? 'none'}
              onChange={handleWorkoutHistoryDaysChange}
            />
          </View>
        </View>

        {/* Image Processing Section */}
        <View>
          <SectionLabel className="mb-2 px-1">
            {t('settings.aiSettings.imageProcessing')}
          </SectionLabel>
          <ToggleInput
            items={[
              {
                key: 'use-ocr-before-ai',
                label: t('settings.aiSettings.useOcrBeforeAi'),
                subtitle: debouncedUseOnDeviceAi
                  ? t('settings.aiSettings.useOcrBeforeAiOnDeviceSubtitle')
                  : t('settings.aiSettings.useOcrBeforeAiSubtitle'),
                value: debouncedUseOcrBeforeAi,
                onValueChange: handleUseOcrBeforeAiChange,
                disabled: debouncedUseOnDeviceAi,
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
              {
                key: 'send-foundation-foods',
                label: t('settings.aiSettings.sendFoundationFoodsToLlm'),
                subtitle: debouncedUseOnDeviceAi
                  ? t('settings.aiSettings.onDeviceAi.foundationFoodsDisabled')
                  : t('settings.aiSettings.sendFoundationFoodsToLlmSubtitle'),
                value: debouncedUseOnDeviceAi ? false : debouncedSendFoundationFoodsToLlm,
                onValueChange: handleSendFoundationFoodsToLlmChange,
                disabled: debouncedUseOnDeviceAi,
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
            ]}
          />
          {/* Photos shrink before they leave the device on native; web sends them as they are. */}
          {Platform.OS !== 'web' ? (
            <View
              className="mt-4 gap-2 px-1"
              style={{ opacity: debouncedUseOnDeviceAi ? 0.4 : 1 }}
              pointerEvents={debouncedUseOnDeviceAi ? 'none' : 'auto'}
            >
              <Text className="text-sm font-semibold" style={{ color: theme.colors.text.primary }}>
                {t('settings.aiSettings.photoQuality.title')}
              </Text>
              <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
                {t('settings.aiSettings.photoQuality.intro')}
              </Text>
              <SegmentedControl
                variant="pill"
                fullWidth
                value={aiImageQuality}
                onValueChange={(value) => {
                  void SettingsService.set(SETTINGS.aiImageQuality, value as AiImageTier);
                }}
                options={AI_IMAGE_TIER_ORDER.map((tier) => ({
                  value: tier,
                  label: t(AI_IMAGE_TIER_KEYS[tier].label),
                }))}
              />
              <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
                {t(AI_IMAGE_TIER_KEYS[aiImageQuality].hint)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Coach personality */}
        <View>
          <SectionLabel className="mb-1 px-1">{t('coach.personaPicker.title')}</SectionLabel>
          <Text className="mb-2 px-1 text-xs text-text-secondary">
            {t('coach.personaPicker.subtitle')}
          </Text>
          <CoachPersonaPicker />
        </View>

        {/* Custom Prompts Section */}
        <View>
          <SectionLabel className="mb-2 px-1">
            {t('settings.aiSettings.customPrompts')}
          </SectionLabel>
          <Pressable
            onPress={() => setIsCustomPromptsVisible(true)}
            className="overflow-hidden rounded-control border bg-bg-card active:bg-bg-overlay"
            style={{
              borderColor: theme.colors.border.light,
              borderWidth: theme.borderWidth.thin,
            }}
          >
            <View className="flex-row items-center justify-between p-4">
              <View className="min-w-0 flex-1 flex-row items-center gap-3">
                <View
                  style={{
                    width: theme.size['8'],
                    height: theme.size['8'],
                    borderRadius: theme.borderRadius.full / 2,
                    backgroundColor: theme.colors.accent.primary20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Settings2 size={theme.iconSize.md} color={theme.colors.accent.primary} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-medium text-text-primary">
                    {t('settings.aiSettings.manageCustomPrompts')}
                  </Text>
                  <Text className="text-xs text-text-secondary" style={{ marginTop: 2 }}>
                    {t('settings.aiSettings.customPromptsSubtitle')}
                  </Text>
                </View>
              </View>
              <View className="shrink-0 justify-center pl-2">
                <ChevronRight size={theme.iconSize.md} color={theme.colors.text.tertiary} />
              </View>
            </View>
          </Pressable>
        </View>
      </View>

      <AiCustomPromptsModal
        visible={isCustomPromptsVisible}
        onClose={() => setIsCustomPromptsVisible(false)}
      />
    </FullScreenModal>
  );
}
