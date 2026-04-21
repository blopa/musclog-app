import {
  Apple,
  Bot,
  ChevronDown,
  ChevronRight,
  Cpu,
  Dumbbell,
  ScanText,
  Settings2,
} from 'lucide-react-native';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Pressable, Text, View } from 'react-native';

import { BottomPopUpMenu, type BottomPopUpMenuItem } from '@/components/BottomPopUpMenu';
import { LegalLinksCard } from '@/components/cards/LegalLinksCard';
import { Button } from '@/components/theme/Button';
import NewNumericalInput from '@/components/theme/NewNumericalInput';
import { SecretInput } from '@/components/theme/SecretInput';
import { TextInput } from '@/components/theme/TextInput';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { GEMINI_MODELS, OPENAI_MODELS } from '@/constants/ai';
import { useDebouncedSettings } from '@/hooks/useDebouncedSettings';
import { useTheme } from '@/hooks/useTheme';
import { isOnDeviceAiAvailable, isOnDeviceAiCapable } from '@/utils/onDeviceAi';

import { AiCustomPromptsModal } from './AiCustomPromptsModal';
import { FullScreenModal } from './FullScreenModal';

type AIIntegrationCardProps = {
  sectionTitle: string;
  sectionTitleColor: string;
  toggleItems: {
    key: string;
    label: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    icon?: ReactNode;
    subtitle?: string;
  }[];
  enabled?: boolean;
  headerContent?: ReactNode;
  apiKeyLabel: string;
  apiKeyValue: string;
  onApiKeyChange: (value: string) => void;
  apiKeyPlaceholder: string;
  apiKeyHelper?: string;
  onSaveApiKey: () => void;
  hasUnsavedChanges?: boolean;
  modelLabel: string;
  modelValue: string;
  onModelPress?: () => void;
  modelFallbackText?: string;
};

function AIIntegrationCard({
  sectionTitle,
  sectionTitleColor,
  toggleItems,
  enabled = true,
  headerContent,
  apiKeyLabel,
  apiKeyValue,
  onApiKeyChange,
  apiKeyPlaceholder,
  apiKeyHelper,
  onSaveApiKey,
  hasUnsavedChanges,
  modelLabel,
  modelValue,
  onModelPress,
  modelFallbackText,
  extraInputs,
}: AIIntegrationCardProps & { extraInputs?: ReactNode }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View>
      <Text
        className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
        style={{ color: sectionTitleColor }}
      >
        {sectionTitle}
      </Text>

      {/* Toggle Block */}
      <ToggleInput items={toggleItems} />

      {/* Settings Block */}
      {enabled ? (
        <View
          style={{
            backgroundColor: theme.colors.background.card,
            borderRadius: theme.borderRadius.lg,
            borderWidth: theme.borderWidth.thin,
            borderColor: theme.colors.border.light,
            overflow: 'hidden',
          }}
        >
          {/* Optional Header Content (e.g., Connect Button) */}
          {headerContent ? (
            <View
              className="w-full items-center"
              style={{
                padding: theme.spacing.padding.base,
                borderBottomWidth: theme.borderWidth.thin,
                borderBottomColor: theme.colors.border.light,
              }}
            >
              {headerContent}
            </View>
          ) : null}

          {/* API Key Input */}
          <View
            style={{
              padding: theme.spacing.padding.base,
              borderBottomWidth: theme.borderWidth.thin,
              borderBottomColor: theme.colors.border.light,
            }}
          >
            {extraInputs}

            <SecretInput
              label={apiKeyLabel}
              value={apiKeyValue}
              onChangeText={onApiKeyChange}
              placeholder={apiKeyPlaceholder}
            />
            {apiKeyHelper ? (
              <Text
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.text.tertiary,
                  marginTop: theme.spacing.padding.sm,
                  marginLeft: theme.spacing.padding.xs,
                }}
              >
                {apiKeyHelper}
              </Text>
            ) : null}

            {/* Save Button */}
            <View className="mb-2 mt-3">
              <Button
                label={
                  hasUnsavedChanges ? t('settings.aiSettings.save') : t('settings.aiSettings.saved')
                }
                onPress={onSaveApiKey}
                disabled={!hasUnsavedChanges}
                size="sm"
                width="full"
                variant={hasUnsavedChanges ? 'accent' : 'outline'}
              />
            </View>
          </View>

          {/* Model Selector */}
          <Pressable onPress={onModelPress} className="overflow-hidden active:bg-bg-overlay">
            <View className="flex-row items-center justify-between p-4">
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-medium text-text-primary">{modelLabel}</Text>
                <Text
                  className="text-xs text-accent-primary"
                  style={{
                    marginTop: theme.spacing.padding.xsHalf,
                  }}
                >
                  {modelValue || modelFallbackText}
                </Text>
              </View>
              <View className="shrink-0 justify-center pl-2">
                <ChevronDown size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
              </View>
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

type AISettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  // Google Gemini
  googleGeminiApiKey?: string;
  onGoogleGeminiApiKeyChange?: (value: string) => void;
  geminiModel?: string;
  onGeminiModelPress?: (model: string) => void;
  // OpenAI
  openAiApiKey?: string;
  onOpenAiApiKeyChange?: (value: string) => void;
  onGetOpenAiKeyPress?: () => void;
  openAiModel?: string;
  onOpenAiModelPress?: (model: string) => void;
  // Local LLM
  localLlmApiKey?: string;
  onLocalLlmApiKeyChange?: (value: string) => void;
  localLlmModel?: string;
  onLocalLlmModelChange?: (value: string) => void;
  localLlmBaseUrl?: string;
  onLocalLlmBaseUrlChange?: (value: string) => void;
};

export function AISettingsModal({
  visible,
  onClose,
  googleGeminiApiKey = '',
  onGoogleGeminiApiKeyChange,
  geminiModel = 'Gemini Pro 1.5',
  onGeminiModelPress,
  openAiApiKey = '',
  onOpenAiApiKeyChange,
  onGetOpenAiKeyPress,
  openAiModel = 'GPT-4o',
  onOpenAiModelPress,
  localLlmApiKey = '',
  onLocalLlmApiKeyChange,
  localLlmModel = 'llama3',
  onLocalLlmModelChange,
  localLlmBaseUrl = 'http://localhost:11434/v1',
  onLocalLlmBaseUrlChange,
}: AISettingsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [geminiModelMenuVisible, setGeminiModelMenuVisible] = useState(false);
  const [openAiModelMenuVisible, setOpenAiModelMenuVisible] = useState(false);
  const [isCustomPromptsVisible, setIsCustomPromptsVisible] = useState(false);

  const [isOnDeviceCapable, setIsOnDeviceCapable] = useState(false);
  const [isOnDeviceReady, setIsOnDeviceReady] = useState(false);

  // Use debounced settings for instant UI updates
  const {
    enableGoogleGemini: debouncedEnableGoogleGemini,
    enableOpenAi: debouncedEnableOpenAi,
    enableLocalLlm: debouncedEnableLocalLlm,
    dailyNutritionInsights: debouncedDailyNutritionInsights,
    workoutInsights: debouncedWorkoutInsights,
    useOcrBeforeAi: debouncedUseOcrBeforeAi,
    useOnDeviceAi: debouncedUseOnDeviceAi,
    useMusclogFreeTier: debouncedUseMusclogFreeTier,
    sendFoundationFoodsToLlm: debouncedSendFoundationFoodsToLlm,
    handleEnableGoogleGeminiChange,
    handleEnableOpenAiChange,
    handleEnableLocalLlmChange,
    handleDailyNutritionInsightsChange,
    handleWorkoutInsightsChange,
    handleUseOcrBeforeAiChange,
    handleUseOnDeviceAiChange,
    handleUseMusclogFreeTierChange,
    handleSendFoundationFoodsToLlmChange,
    maxAiMemories: debouncedMaxAiMemories,
    handleMaxAiMemoriesChange,
    flushAllPendingChanges,
  } = useDebouncedSettings(500);

  const reloadOnDeviceAiState = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      return;
    }
    try {
      const capable = await isOnDeviceAiCapable();
      setIsOnDeviceCapable(capable);
      if (!capable) {
        setIsOnDeviceReady(false);
        return;
      }
      const ready = await isOnDeviceAiAvailable();
      setIsOnDeviceReady(ready);
    } catch {
      setIsOnDeviceCapable(false);
      setIsOnDeviceReady(false);
    }
  }, []);

  useEffect(() => {
    if (!visible || Platform.OS !== 'ios') {
      return;
    }
    void reloadOnDeviceAiState();
  }, [visible, reloadOnDeviceAiState]);

  // Flush pending settings changes when modal closes
  useEffect(() => {
    if (!visible) {
      flushAllPendingChanges();
    }
  }, [visible, flushAllPendingChanges]);

  // Local state for API keys & local LLM configs (to avoid saving on every keystroke)
  const [localGeminiApiKey, setLocalGeminiApiKey] = useState(googleGeminiApiKey);
  const [localOpenAiApiKey, setLocalOpenAiApiKey] = useState(openAiApiKey);
  const [localStateLlmApiKey, setLocalStateLlmApiKey] = useState(localLlmApiKey);
  const [localStateLlmModel, setLocalStateLlmModel] = useState(localLlmModel);
  const [localStateLlmBaseUrl, setLocalStateLlmBaseUrl] = useState(localLlmBaseUrl);

  // Track if there are unsaved changes
  const hasGeminiKeyChanges = localGeminiApiKey !== googleGeminiApiKey;
  const hasOpenAiKeyChanges = localOpenAiApiKey !== openAiApiKey;
  const hasLocalLlmChanges =
    localStateLlmApiKey !== localLlmApiKey ||
    localStateLlmModel !== localLlmModel ||
    localStateLlmBaseUrl !== localLlmBaseUrl;

  // Save handlers
  const handleSaveGeminiApiKey = () => {
    onGoogleGeminiApiKeyChange?.(localGeminiApiKey);
  };

  const handleSaveOpenAiApiKey = () => {
    onOpenAiApiKeyChange?.(localOpenAiApiKey);
  };

  const handleSaveLocalLlmConfig = () => {
    onLocalLlmApiKeyChange?.(localStateLlmApiKey);
    onLocalLlmModelChange?.(localStateLlmModel);
    onLocalLlmBaseUrlChange?.(localStateLlmBaseUrl);
  };

  // Sync local state when props change (e.g., when modal opens with saved values)
  useEffect(() => {
    setLocalGeminiApiKey(googleGeminiApiKey);
    setLocalOpenAiApiKey(openAiApiKey);
    setLocalStateLlmApiKey(localLlmApiKey);
    setLocalStateLlmModel(localLlmModel);
    setLocalStateLlmBaseUrl(localLlmBaseUrl);
  }, [googleGeminiApiKey, openAiApiKey, localLlmApiKey, localLlmModel, localLlmBaseUrl]);

  const geminiToggleItems = [
    {
      key: 'enable-gemini',
      label: t('settings.aiSettings.enableGoogleGemini'),
      value: debouncedEnableGoogleGemini,
      onValueChange: handleEnableGoogleGeminiChange,
      icon: (
        <View
          style={{
            width: theme.size['8'],
            height: theme.size['8'],
            borderRadius: theme.borderRadius.full / 2,
            backgroundColor: theme.colors.status.info10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bot size={theme.iconSize.lg} color={theme.colors.status.info} />
        </View>
      ),
    },
  ];

  const localLlmToggleItems = [
    {
      key: 'enable-local-llm',
      label: t('settings.aiSettings.enableLocalLlm'),
      value: debouncedEnableLocalLlm,
      onValueChange: handleEnableLocalLlmChange,
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
          <Bot size={theme.iconSize.md} color={theme.colors.status.success} />
        </View>
      ),
    },
  ];

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

  const openAiToggleItems = [
    {
      key: 'enable-openai',
      label: t('settings.aiSettings.enableOpenAi'),
      value: debouncedEnableOpenAi,
      onValueChange: handleEnableOpenAiChange,
      icon: (
        <View
          style={{
            width: theme.size['8'],
            height: theme.size['8'],
            borderRadius: theme.borderRadius.full / 2,
            backgroundColor: theme.colors.status.indigo10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bot size={theme.iconSize.md} color={theme.colors.status.indigo} />
        </View>
      ),
    },
  ];

  const geminiModelMenuItems: BottomPopUpMenuItem[] = Object.values(GEMINI_MODELS).map((model) => ({
    icon: Bot,
    iconColor: theme.colors.status.info,
    iconBgColor: theme.colors.status.info10,
    title: model.model,
    description: `Google Gemini ${model.model}`,
    onPress: () => onGeminiModelPress?.(model.model),
  }));

  const openAiModelMenuItems: BottomPopUpMenuItem[] = Object.values(OPENAI_MODELS).map((model) => ({
    icon: Bot,
    iconColor: theme.colors.status.indigo,
    iconBgColor: theme.colors.status.indigo10,
    title: model.model,
    description: `OpenAI ${model.model}`,
    onPress: () => onOpenAiModelPress?.(model.model),
  }));

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={t('settings.aiSettings.title')}>
      <View className="gap-6 px-4 py-6" style={{ minHeight: '100%' }}>
        {/* Musclog Free Tier Section */}
        <View className="gap-3">
          <Text
            className="px-5 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.accent.primary }}
          >
            {t('settings.aiSettings.musclogFreeTier.sectionTitle')}
          </Text>
          <ToggleInput
            items={[
              {
                key: 'use-musclog-free-tier',
                label: t('settings.aiSettings.musclogFreeTier.toggle'),
                subtitle: t('settings.aiSettings.musclogFreeTier.toggleSubtitle'),
                value: debouncedUseMusclogFreeTier,
                onValueChange: handleUseMusclogFreeTierChange,
              },
            ]}
          />
          {debouncedUseMusclogFreeTier ? (
            <Text className="px-5 text-xs" style={{ color: theme.colors.text.tertiary }}>
              {t('settings.aiSettings.musclogFreeTier.activeNote')}
            </Text>
          ) : null}
        </View>

        {/* Provider sections (dimmed when free tier is active) */}
        <View
          style={{ opacity: debouncedUseMusclogFreeTier ? 0.4 : 1 }}
          pointerEvents={debouncedUseMusclogFreeTier ? 'none' : 'auto'}
        >
          <View className="gap-6">
            {/* Google Gemini Integration Section */}
            <AIIntegrationCard
              sectionTitle={t('settings.aiSettings.googleGeminiIntegration')}
              sectionTitleColor={theme.colors.accent.primary}
              toggleItems={geminiToggleItems}
              enabled={debouncedEnableGoogleGemini}
              apiKeyLabel={t('settings.aiSettings.googleGeminiApiKey')}
              apiKeyValue={localGeminiApiKey}
              onApiKeyChange={setLocalGeminiApiKey}
              apiKeyPlaceholder={t('settings.aiSettings.apiKeyPlaceholder')}
              apiKeyHelper={t('settings.aiSettings.apiKeyHelper')}
              onSaveApiKey={handleSaveGeminiApiKey}
              hasUnsavedChanges={hasGeminiKeyChanges}
              modelLabel={t('settings.aiSettings.geminiModel')}
              modelValue={geminiModel}
              onModelPress={() => setGeminiModelMenuVisible(true)}
            />

            {/* OpenAI Integration Section */}
            <AIIntegrationCard
              sectionTitle={t('settings.aiSettings.openAiIntegration')}
              sectionTitleColor={theme.colors.accent.primary}
              toggleItems={openAiToggleItems}
              enabled={debouncedEnableOpenAi}
              headerContent={
                onGetOpenAiKeyPress ? (
                  <Button
                    label={t('settings.aiSettings.getOpenAiKey')}
                    onPress={onGetOpenAiKeyPress}
                    size="sm"
                    width="full"
                    variant="outline"
                  />
                ) : undefined
              }
              apiKeyLabel={t('settings.aiSettings.openAiApiKey')}
              apiKeyValue={localOpenAiApiKey}
              onApiKeyChange={setLocalOpenAiApiKey}
              apiKeyPlaceholder={t('settings.aiSettings.apiKeyPlaceholder')}
              onSaveApiKey={handleSaveOpenAiApiKey}
              hasUnsavedChanges={hasOpenAiKeyChanges}
              modelLabel={t('settings.aiSettings.openAiModel')}
              modelValue={openAiModel}
              onModelPress={() => setOpenAiModelMenuVisible(true)}
              modelFallbackText={t('settings.aiSettings.selectModel')}
            />

            {/* Local LLM Integration Section */}
            <AIIntegrationCard
              sectionTitle={t('settings.aiSettings.localLlmIntegration')}
              sectionTitleColor={theme.colors.accent.primary}
              toggleItems={localLlmToggleItems}
              enabled={debouncedEnableLocalLlm}
              headerContent={
                <Button
                  label={t('settings.aiSettings.localLlmHelp')}
                  onPress={() => {
                    Linking.openURL('https://ollama.com/blog/openai-compatibility').catch(() => {});
                  }}
                  size="sm"
                  width="full"
                  variant="outline"
                />
              }
              apiKeyLabel={t('settings.aiSettings.localLlmApiKey')}
              apiKeyValue={localStateLlmApiKey}
              onApiKeyChange={setLocalStateLlmApiKey}
              apiKeyPlaceholder={t('settings.aiSettings.apiKeyPlaceholder')}
              apiKeyHelper={t('settings.aiSettings.localLlmApiKeyHelper')}
              onSaveApiKey={handleSaveLocalLlmConfig}
              hasUnsavedChanges={hasLocalLlmChanges}
              modelLabel={t('settings.aiSettings.localLlmModel')}
              modelValue={localStateLlmModel}
              onModelPress={() => {}}
              extraInputs={
                <View className="mb-4 gap-4">
                  <TextInput
                    label={t('settings.aiSettings.localLlmBaseUrl')}
                    value={localStateLlmBaseUrl}
                    onChangeText={setLocalStateLlmBaseUrl}
                    placeholder="http://localhost:11434/v1"
                  />
                  <TextInput
                    label={t('settings.aiSettings.localLlmModel')}
                    value={localStateLlmModel}
                    onChangeText={setLocalStateLlmModel}
                    placeholder="llama3"
                  />
                </View>
              }
            />

            {/* Apple Intelligence Section (iOS only) */}
            {Platform.OS === 'ios' && isOnDeviceCapable ? (
              <View className="gap-3">
                <Text
                  className="px-5 text-xs font-bold uppercase tracking-wider"
                  style={{ color: theme.colors.accent.primary }}
                >
                  {t('settings.aiSettings.onDeviceAi.sectionTitle')}
                </Text>

                <ToggleInput
                  items={[
                    {
                      key: 'use-on-device-ai',
                      label: t('settings.aiSettings.onDeviceAi.toggle'),
                      subtitle: isOnDeviceReady
                        ? t('settings.aiSettings.onDeviceAi.toggleSubtitle')
                        : t('settings.aiSettings.onDeviceAi.toggleSubtitleNotReady'),
                      value: debouncedUseOnDeviceAi,
                      onValueChange: handleUseOnDeviceAiChange,
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
                          <Cpu size={theme.iconSize.md} color={theme.colors.status.success} />
                        </View>
                      ),
                    },
                  ]}
                />

                <Text className="px-5 text-xs" style={{ color: theme.colors.text.tertiary }}>
                  {t('settings.aiSettings.onDeviceAi.privacyNote')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Insights & Alerts Section */}
        <View>
          <Text
            className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('settings.aiSettings.insightsAlerts')}
          </Text>
          <ToggleInput items={insightsItems} />
        </View>

        {/* Memory Settings Section */}
        <View>
          <Text
            className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('settings.aiSettings.memorySettings')}
          </Text>
          <View
            className="rounded-lg border bg-bg-card p-4"
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
        </View>

        {/* Image Processing Section */}
        <View>
          <Text
            className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('settings.aiSettings.imageProcessing')}
          </Text>
          <ToggleInput
            items={[
              {
                key: 'use-ocr-before-ai',
                label: t('settings.aiSettings.useOcrBeforeAi'),
                subtitle: t('settings.aiSettings.useOcrBeforeAiSubtitle'),
                value: debouncedUseOcrBeforeAi,
                onValueChange: handleUseOcrBeforeAiChange,
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
        </View>

        {/* Custom Prompts Section */}
        <View>
          <Text
            className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('settings.aiSettings.customPrompts')}
          </Text>
          <Pressable
            onPress={() => setIsCustomPromptsVisible(true)}
            className="overflow-hidden rounded-lg border bg-bg-card active:bg-bg-overlay"
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
                  }}
                >
                  <Settings2 size={theme.iconSize.md} color={theme.colors.accent.primary} />
                </View>
                <View>
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

        <LegalLinksCard />

        {/* Model Selection Menus */}
        <BottomPopUpMenu
          visible={geminiModelMenuVisible}
          onClose={() => setGeminiModelMenuVisible(false)}
          title={t('settings.aiSettings.selectGeminiModel')}
          subtitle={t('settings.aiSettings.selectGeminiModelSubtitle')}
          items={geminiModelMenuItems}
        />

        <BottomPopUpMenu
          visible={openAiModelMenuVisible}
          onClose={() => setOpenAiModelMenuVisible(false)}
          title={t('settings.aiSettings.selectOpenAiModel')}
          subtitle={t('settings.aiSettings.selectOpenAiModelSubtitle')}
          items={openAiModelMenuItems}
        />
      </View>

      <AiCustomPromptsModal
        visible={isCustomPromptsVisible}
        onClose={() => setIsCustomPromptsVisible(false)}
      />
    </FullScreenModal>
  );
}
