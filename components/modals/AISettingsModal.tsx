import {
  Apple,
  Bot,
  ChevronDown,
  ChevronRight,
  Cpu,
  Dumbbell,
  ExternalLink,
  ScanText,
  Settings2,
} from 'lucide-react-native';
import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Pressable, Text, View } from 'react-native';

import { BottomPopUpMenu, type BottomPopUpMenuItem } from '@/components/BottomPopUpMenu';
import { LegalLinksCard } from '@/components/cards/LegalLinksCard';
import { Button } from '@/components/theme/Button';
import NewNumericalInput from '@/components/theme/NewNumericalInput';
import { SecretInput } from '@/components/theme/SecretInput';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { GEMINI_MODELS, OPENAI_MODELS } from '@/constants/ai';
import { useDebouncedSettings } from '@/hooks/useDebouncedSettings';
import { useTheme } from '@/hooks/useTheme';
import {
  type DownloadableModel,
  downloadOnDeviceModel,
  getCompatibleDownloadableModels,
  isOnDeviceAiAvailable,
  isOnDeviceAiCapable,
} from '@/utils/onDeviceAi';

import { AiCustomPromptsModal } from './AiCustomPromptsModal';
import { FullScreenModal } from './FullScreenModal';

const AICORE_ENROLLMENT_URL = 'https://developers.google.com/ml-kit/genai/aicore-dev-preview';
const AICORE_PLAY_STORE_URL = 'market://details?id=com.google.android.aicore';
const AICORE_PLAY_STORE_WEB_URL =
  'https://play.google.com/store/apps/details?id=com.google.android.aicore';

async function openAiCoreEnrollment() {
  await Linking.openURL(AICORE_ENROLLMENT_URL);
}

async function openAiCorePlayStore() {
  const canOpen = await Linking.canOpenURL(AICORE_PLAY_STORE_URL);
  await Linking.openURL(canOpen ? AICORE_PLAY_STORE_URL : AICORE_PLAY_STORE_WEB_URL);
}

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
}: AIIntegrationCardProps) {
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
}: AISettingsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [geminiModelMenuVisible, setGeminiModelMenuVisible] = useState(false);
  const [openAiModelMenuVisible, setOpenAiModelMenuVisible] = useState(false);
  const [isCustomPromptsVisible, setIsCustomPromptsVisible] = useState(false);

  const [isOnDeviceCapable, setIsOnDeviceCapable] = useState(false);
  const [isOnDeviceReady, setIsOnDeviceReady] = useState(false);
  const [downloadableModels, setDownloadableModels] = useState<DownloadableModel[]>([]);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Use debounced settings for instant UI updates
  const {
    enableGoogleGemini: debouncedEnableGoogleGemini,
    enableOpenAi: debouncedEnableOpenAi,
    dailyNutritionInsights: debouncedDailyNutritionInsights,
    workoutInsights: debouncedWorkoutInsights,
    useOcrBeforeAi: debouncedUseOcrBeforeAi,
    useOnDeviceAi: debouncedUseOnDeviceAi,
    sendFoundationFoodsToLlm: debouncedSendFoundationFoodsToLlm,
    handleEnableGoogleGeminiChange,
    handleEnableOpenAiChange,
    handleDailyNutritionInsightsChange,
    handleWorkoutInsightsChange,
    handleUseOcrBeforeAiChange,
    handleUseOnDeviceAiChange,
    handleSendFoundationFoodsToLlmChange,
    maxAiMemories: debouncedMaxAiMemories,
    handleMaxAiMemoriesChange,
    flushAllPendingChanges,
  } = useDebouncedSettings(500);

  // Check on-device AI capability + model state when modal opens
  useEffect(() => {
    if (!visible || Platform.OS === 'web') {
      return;
    }

    isOnDeviceAiCapable()
      .then((capable) => {
        setIsOnDeviceCapable(capable);
        if (!capable) {
          return;
        }
        // Check if built-in model is actually ready (probe)
        isOnDeviceAiAvailable()
          .then(setIsOnDeviceReady)
          .catch(() => setIsOnDeviceReady(false));
        // Load downloadable models for this device
        getCompatibleDownloadableModels()
          .then(setDownloadableModels)
          .catch(() => {});
      })
      .catch(() => setIsOnDeviceCapable(false));
  }, [visible]);

  // Flush pending settings changes when modal closes
  useEffect(() => {
    if (!visible) {
      flushAllPendingChanges();
    }
  }, [visible, flushAllPendingChanges]);

  // Local state for API keys (to avoid saving on every keystroke)
  const [localGeminiApiKey, setLocalGeminiApiKey] = useState(googleGeminiApiKey);
  const [localOpenAiApiKey, setLocalOpenAiApiKey] = useState(openAiApiKey);

  // Track if there are unsaved changes
  const hasGeminiKeyChanges = localGeminiApiKey !== googleGeminiApiKey;
  const hasOpenAiKeyChanges = localOpenAiApiKey !== openAiApiKey;

  // Save handlers
  const handleSaveGeminiApiKey = () => {
    onGoogleGeminiApiKeyChange?.(localGeminiApiKey);
  };

  const handleSaveOpenAiApiKey = () => {
    onOpenAiApiKeyChange?.(localOpenAiApiKey);
  };

  // Sync local state when props change (e.g., when modal opens with saved values)
  useEffect(() => {
    setLocalGeminiApiKey(googleGeminiApiKey);
    setLocalOpenAiApiKey(openAiApiKey);
  }, [googleGeminiApiKey, openAiApiKey]);

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

        {/* On-Device AI Section */}
        {isOnDeviceCapable ? (
          <View className="gap-3">
            <Text
              className="px-5 text-xs font-bold uppercase tracking-wider"
              style={{ color: theme.colors.accent.primary }}
            >
              {t('settings.aiSettings.onDeviceAi.sectionTitle')}
            </Text>

            {/* Toggle — only enabled when model is ready */}
            <ToggleInput
              items={[
                {
                  key: 'use-on-device-ai',
                  label: t('settings.aiSettings.onDeviceAi.toggle'),
                  subtitle: isOnDeviceReady
                    ? t('settings.aiSettings.onDeviceAi.toggleSubtitle')
                    : t('settings.aiSettings.onDeviceAi.toggleSubtitleNotReady'),
                  value: debouncedUseOnDeviceAi && isOnDeviceReady,
                  onValueChange: isOnDeviceReady ? handleUseOnDeviceAiChange : () => {},
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

            {/* "Not ready" instructions card */}
            {!isOnDeviceReady ? (
              <View
                style={{
                  backgroundColor: theme.colors.background.card,
                  borderRadius: theme.borderRadius.lg,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: theme.colors.border.light,
                  overflow: 'hidden',
                  padding: theme.spacing.padding.base,
                  gap: theme.spacing.padding.sm,
                }}
              >
                <Text className="text-sm font-semibold text-text-primary">
                  {t('settings.aiSettings.onDeviceAi.builtInNotReady')}
                </Text>
                <Text className="text-xs text-text-secondary">
                  {t('settings.aiSettings.onDeviceAi.builtInNotReadySubtitle')}
                </Text>

                {/* Numbered steps */}
                {(
                  t('settings.aiSettings.onDeviceAi.builtInSteps', {
                    returnObjects: true,
                  }) as string[]
                ).map((step, i) => (
                  <View key={i} className="flex-row items-start gap-2">
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: theme.colors.accent.primary20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 1,
                        flexShrink: 0,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: theme.typography.fontSize.xs,
                          fontWeight: 'bold',
                          color: theme.colors.accent.primary,
                        }}
                      >
                        {i + 1}
                      </Text>
                    </View>
                    <Text className="flex-1 text-xs text-text-secondary">{step}</Text>
                  </View>
                ))}

                <Text className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                  {t('settings.aiSettings.onDeviceAi.builtInDownloadNote')}
                </Text>

                <View className="mt-1 gap-2">
                  <Pressable
                    onPress={openAiCoreEnrollment}
                    className="flex-row items-center justify-center gap-2 active:opacity-70"
                    style={{
                      backgroundColor: theme.colors.accent.primary,
                      padding: theme.spacing.padding.sm,
                      borderRadius: theme.borderRadius.md,
                    }}
                  >
                    <Text
                      style={{
                        color: theme.colors.text.black,
                        fontSize: theme.typography.fontSize.sm,
                        fontWeight: '600',
                      }}
                    >
                      {t('settings.aiSettings.onDeviceAi.openEnrollment')}
                    </Text>
                    <ExternalLink size={theme.iconSize.sm} color={theme.colors.text.black} />
                  </Pressable>
                  <Pressable
                    onPress={openAiCorePlayStore}
                    className="flex-row items-center justify-center gap-2 active:opacity-70"
                    style={{
                      borderWidth: theme.borderWidth.thin,
                      borderColor: theme.colors.accent.primary,
                      padding: theme.spacing.padding.sm,
                      borderRadius: theme.borderRadius.md,
                    }}
                  >
                    <Text
                      style={{
                        color: theme.colors.accent.primary,
                        fontSize: theme.typography.fontSize.sm,
                        fontWeight: '600',
                      }}
                    >
                      {t('settings.aiSettings.onDeviceAi.openAiCorePlayStore')}
                    </Text>
                    <ExternalLink size={theme.iconSize.sm} color={theme.colors.accent.primary} />
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* Download section — shown when model isn't ready yet */}
            {!isOnDeviceReady && downloadableModels.length > 0 ? (
              <View
                style={{
                  backgroundColor: theme.colors.background.card,
                  borderRadius: theme.borderRadius.lg,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: theme.colors.border.light,
                  overflow: 'hidden',
                  padding: theme.spacing.padding.base,
                  gap: theme.spacing.padding.sm,
                }}
              >
                <Text className="text-sm font-semibold text-text-primary">
                  {t('settings.aiSettings.onDeviceAi.downloadRequired')}
                </Text>
                <Text className="text-xs text-text-secondary">
                  {t('settings.aiSettings.onDeviceAi.downloadRequiredSubtitle')}
                </Text>

                {downloadableModels.map((model) => {
                  const isDownloading = downloadingModelId === model.id;
                  const isDownloaded = model.status === 'ready' || model.status === 'loading';
                  const sizeMb = Math.round(model.sizeBytes / 1_000_000);

                  const handleDownload = async () => {
                    setDownloadError(null);
                    setDownloadingModelId(model.id);
                    setDownloadProgress(0);
                    try {
                      await downloadOnDeviceModel(model.id, (p) => setDownloadProgress(p));
                      setIsOnDeviceReady(true);
                      setDownloadingModelId(null);
                    } catch (e) {
                      setDownloadError(e instanceof Error ? e.message : String(e));
                      setDownloadingModelId(null);
                    }
                  };

                  return (
                    <View
                      key={model.id}
                      style={{
                        gap: theme.spacing.padding.sm,
                        paddingTop: theme.spacing.padding.sm,
                        borderTopWidth: theme.borderWidth.thin,
                        borderTopColor: theme.colors.border.light,
                      }}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-text-primary">
                            {model.name}
                          </Text>
                          <Text className="text-xs text-text-tertiary">
                            {model.parameterCount} ·{' '}
                            {sizeMb >= 1000 ? `${(sizeMb / 1000).toFixed(1)} GB` : `${sizeMb} MB`}
                          </Text>
                        </View>
                        {!isDownloading && !isDownloaded ? (
                          <Button
                            label={t('settings.aiSettings.onDeviceAi.download')}
                            onPress={handleDownload}
                            size="sm"
                            variant="accent"
                            disabled={downloadingModelId !== null}
                          />
                        ) : isDownloaded ? (
                          <Text
                            className="text-xs font-semibold"
                            style={{ color: theme.colors.status.success }}
                          >
                            {t('settings.aiSettings.onDeviceAi.downloaded')}
                          </Text>
                        ) : null}
                      </View>

                      {/* Progress bar */}
                      {isDownloading ? (
                        <View className="gap-1">
                          <View
                            style={{
                              height: 4,
                              backgroundColor: theme.colors.border.light,
                              borderRadius: 2,
                              overflow: 'hidden',
                            }}
                          >
                            <View
                              style={{
                                height: '100%',
                                width: `${Math.round(downloadProgress * 100)}%`,
                                backgroundColor: theme.colors.accent.primary,
                                borderRadius: 2,
                              }}
                            />
                          </View>
                          <Text className="text-xs text-text-tertiary">
                            {t('settings.aiSettings.onDeviceAi.downloading', {
                              percent: Math.round(downloadProgress * 100),
                            })}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}

                {downloadError ? (
                  <Text className="text-xs" style={{ color: theme.colors.status.error }}>
                    {downloadError}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Text className="px-5 text-xs" style={{ color: theme.colors.text.tertiary }}>
              {t('settings.aiSettings.onDeviceAi.privacyNote')}
            </Text>
          </View>
        ) : null}

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
                subtitle: t('settings.aiSettings.sendFoundationFoodsToLlmSubtitle'),
                value: debouncedSendFoundationFoodsToLlm,
                onValueChange: handleSendFoundationFoodsToLlmChange,
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
