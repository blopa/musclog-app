import { Bot, ChevronDown, Settings2 } from 'lucide-react-native';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, View } from 'react-native';

import { BottomPopUpMenu, type BottomPopUpMenuItem } from '@/components/BottomPopUpMenu';
import { LegalLinksCard } from '@/components/cards/LegalLinksCard';
import { OnDeviceAiSection } from '@/components/settings/OnDeviceAiSection';
import { PremiumCard } from '@/components/settings/PremiumCard';
import { Button } from '@/components/theme/Button';
import { ListRow } from '@/components/theme/ListRow';
import { SecretInput } from '@/components/theme/SecretInput';
import { TextInput } from '@/components/theme/TextInput';
import { ToggleInput } from '@/components/theme/ToggleInput';
import {
  CLAUDE_MODELS,
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
  GEMINI_MODELS,
  OPENAI_MODELS,
} from '@/constants/ai';
import { SETTINGS } from '@/constants/settingDefinitions';
import { useSnackbar } from '@/context/SnackbarContext';
import { SettingsService } from '@/database/services/SettingsService';
import { useDebouncedSettings } from '@/hooks/useDebouncedSettings';
import { usePremium } from '@/hooks/usePremium';
import { useSettings } from '@/hooks/useSettings';
import { useSubModalState } from '@/hooks/useSubModalVisibility';
import { useTheme } from '@/hooks/useTheme';
import { needsFreeTierConsent } from '@/utils/aiConsent';
import { type AiKeyTestResult, testApiKey } from '@/utils/aiKeyTest';
import {
  effectiveUseMusclogGateway,
  isMusclogGatewayAvailable,
} from '@/utils/musclogGatewayAvailability';

import { AIBehaviorSettingsModal } from './AIBehaviorSettingsModal';
import { ConfirmationModal } from './ConfirmationModal';
import { FullScreenModal } from './FullScreenModal';
import { PremiumModal } from './PremiumModal';

const AI_KEY_TEST_MESSAGE_KEYS = {
  ok: 'errors.aiKeyTestOk',
  rejected: 'errors.aiKeyTestRejected',
  network: 'errors.aiKeyTestNetwork',
} as const satisfies Record<AiKeyTestResult, string>;

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
  /** Checks the key as typed against the provider. Omitted for providers with nothing to check. */
  onTestKey?: () => Promise<AiKeyTestResult>;
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
  onTestKey,
  hasUnsavedChanges,
  modelLabel,
  modelValue,
  onModelPress,
  modelFallbackText,
  extraInputs,
}: AIIntegrationCardProps & { extraInputs?: ReactNode }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [testResult, setTestResult] = useState<AiKeyTestResult | 'testing' | null>(null);

  const handleTestKey = async () => {
    if (!onTestKey) {
      return;
    }

    setTestResult('testing');
    setTestResult(await onTestKey());
  };

  return (
    <View>
      <Text className="mb-2 px-5 text-xs font-semibold" style={{ color: sectionTitleColor }}>
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
            {onTestKey ? (
              <View className="mb-2 gap-2">
                <Button
                  label={
                    testResult === 'testing'
                      ? t('settings.aiSettings.testingKey')
                      : t('settings.aiSettings.testKey')
                  }
                  onPress={handleTestKey}
                  disabled={testResult === 'testing' || !apiKeyValue.trim()}
                  size="sm"
                  width="full"
                  variant="outline"
                />
                {testResult && testResult !== 'testing' ? (
                  <Text
                    className="text-xs font-medium"
                    style={{
                      color:
                        testResult === 'ok'
                          ? theme.colors.status.success
                          : theme.colors.status.error,
                    }}
                    testID="ai-key-test-result"
                  >
                    {t(AI_KEY_TEST_MESSAGE_KEYS[testResult])}
                  </Text>
                ) : null}
              </View>
            ) : null}
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
  // Anthropic Claude
  claudeApiKey?: string;
  onClaudeApiKeyChange?: (value: string) => void;
  claudeModel?: string;
  onClaudeModelPress?: (model: string) => void;
  // Local LLM
  localLlmApiKey?: string;
  onLocalLlmApiKeyChange?: (value: string) => void;
  localLlmModel?: string;
  onLocalLlmModelChange?: (value: string) => void;
  localLlmBaseUrl?: string;
  onLocalLlmBaseUrlChange?: (value: string) => void;
};

type ModelMenuKey = 'gemini' | 'openai' | 'claude';

export function AISettingsModal({
  visible,
  onClose,
  googleGeminiApiKey,
  onGoogleGeminiApiKeyChange,
  geminiModel,
  onGeminiModelPress,
  openAiApiKey,
  onOpenAiApiKeyChange,
  onGetOpenAiKeyPress,
  openAiModel,
  onOpenAiModelPress,
  claudeApiKey,
  onClaudeApiKeyChange,
  claudeModel,
  onClaudeModelPress,
  localLlmApiKey,
  onLocalLlmApiKeyChange,
  localLlmModel,
  onLocalLlmModelChange,
  localLlmBaseUrl,
  onLocalLlmBaseUrlChange,
}: AISettingsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const settings = useSettings();
  const [activeModelMenu, setActiveModelMenu] = useSubModalState<ModelMenuKey | null>(
    visible,
    null
  );
  const [behaviorVisible, setBehaviorVisible] = useState(false);
  const [freeTierConsentVisible, setFreeTierConsentVisible] = useState(false);
  const [premiumVisible, setPremiumVisible] = useState(false);
  // Loads the overview while this screen is open; `PremiumCard` below reads the same store.
  const premium = usePremium({ load: visible });
  const isMusclogIronActive =
    premium.enabled && premium.view.phase === 'active' && premium.useHostedAi;

  const resolvedGeminiApiKey = googleGeminiApiKey ?? settings.googleGeminiApiKey ?? '';
  const resolvedGeminiModel = geminiModel ?? settings.googleGeminiModel ?? DEFAULT_GEMINI_MODEL;
  const resolvedOpenAiApiKey = openAiApiKey ?? settings.openAiApiKey ?? '';
  const resolvedOpenAiModel = openAiModel ?? settings.openAiModel ?? DEFAULT_OPENAI_MODEL;
  const resolvedClaudeApiKey = claudeApiKey ?? settings.claudeApiKey ?? '';
  const resolvedClaudeModel = claudeModel ?? settings.claudeModel ?? DEFAULT_CLAUDE_MODEL;
  const resolvedLocalLlmApiKey = localLlmApiKey ?? settings.localLlmApiKey ?? '';
  const resolvedLocalLlmModel = localLlmModel ?? settings.localLlmModel ?? 'llama3';
  const resolvedLocalLlmBaseUrl =
    localLlmBaseUrl ?? settings.localLlmBaseUrl ?? 'http://localhost:11434/v1';

  // Use debounced settings for instant UI updates
  const {
    enableGoogleGemini: debouncedEnableGoogleGemini,
    enableOpenAi: debouncedEnableOpenAi,
    enableClaude: debouncedEnableClaude,
    enableLocalLlm: debouncedEnableLocalLlm,
    useMusclogFreeTier: debouncedUseMusclogFreeTier,
    thinkingLevel: debouncedThinkingLevel,
    handleEnableGoogleGeminiChange,
    handleEnableOpenAiChange,
    handleEnableClaudeChange,
    handleEnableLocalLlmChange,
    handleUseMusclogFreeTierChange,
    handleThinkingLevelChange,
    flushAllPendingChanges,
  } = useDebouncedSettings(500);
  const { showSnackbar } = useSnackbar();

  // A local model costs nothing per call, so deeper thinking is only upside: switching the
  // local LLM on also turns thinking mode on (once, and only if it was off), and says so.
  const handleEnableLocalLlmWithThinking = useCallback(
    (enabled: boolean) => {
      handleEnableLocalLlmChange(enabled);

      if (enabled && !debouncedEnableLocalLlm && debouncedThinkingLevel === 'off') {
        handleThinkingLevelChange('medium');
        showSnackbar('success', t('settings.aiSettings.localLlmThinkingEnabled'), {
          duration: 5000,
        });
      }
    },
    [
      debouncedEnableLocalLlm,
      debouncedThinkingLevel,
      handleEnableLocalLlmChange,
      handleThinkingLevelChange,
      showSnackbar,
      t,
    ]
  );
  const musclogGatewayAvailable = isMusclogGatewayAvailable();
  const useMusclogGateway = effectiveUseMusclogGateway(debouncedUseMusclogFreeTier);

  // Flush pending settings changes when modal closes
  useEffect(() => {
    if (!visible) {
      const flush = () => {
        flushAllPendingChanges();
      };

      flush();
    }
  }, [visible, flushAllPendingChanges]);

  // Local state for API keys & local LLM configs (to avoid saving on every keystroke)
  const [localGeminiApiKey, setLocalGeminiApiKey] = useState(resolvedGeminiApiKey);
  const [localOpenAiApiKey, setLocalOpenAiApiKey] = useState(resolvedOpenAiApiKey);
  const [localClaudeApiKey, setLocalClaudeApiKey] = useState(resolvedClaudeApiKey);
  const [localStateLlmApiKey, setLocalStateLlmApiKey] = useState(resolvedLocalLlmApiKey);
  const [localStateLlmModel, setLocalStateLlmModel] = useState(resolvedLocalLlmModel);
  const [localStateLlmBaseUrl, setLocalStateLlmBaseUrl] = useState(resolvedLocalLlmBaseUrl);

  // Track if there are unsaved changes
  const hasGeminiKeyChanges = localGeminiApiKey !== resolvedGeminiApiKey;
  const hasOpenAiKeyChanges = localOpenAiApiKey !== resolvedOpenAiApiKey;
  const hasClaudeKeyChanges = localClaudeApiKey !== resolvedClaudeApiKey;
  const hasLocalLlmChanges =
    localStateLlmApiKey !== resolvedLocalLlmApiKey ||
    localStateLlmModel !== resolvedLocalLlmModel ||
    localStateLlmBaseUrl !== resolvedLocalLlmBaseUrl;

  // Save handlers
  const handleSaveGeminiApiKey = () => {
    if (onGoogleGeminiApiKeyChange) {
      onGoogleGeminiApiKeyChange(localGeminiApiKey);
    } else {
      void SettingsService.setGoogleGeminiApiKey(localGeminiApiKey);
    }
  };

  const handleSaveClaudeApiKey = () => {
    if (onClaudeApiKeyChange) {
      onClaudeApiKeyChange(localClaudeApiKey);
    } else {
      void SettingsService.setClaudeApiKey(localClaudeApiKey);
    }
  };

  const handleSaveOpenAiApiKey = () => {
    if (onOpenAiApiKeyChange) {
      onOpenAiApiKeyChange(localOpenAiApiKey);
    } else {
      void SettingsService.setOpenAiApiKey(localOpenAiApiKey);
    }
  };

  const handleSaveLocalLlmConfig = () => {
    if (onLocalLlmApiKeyChange) {
      onLocalLlmApiKeyChange(localStateLlmApiKey);
    } else {
      void SettingsService.setLocalLlmApiKey(localStateLlmApiKey);
    }

    if (onLocalLlmModelChange) {
      onLocalLlmModelChange(localStateLlmModel);
    } else {
      void SettingsService.setLocalLlmModel(localStateLlmModel);
    }

    if (onLocalLlmBaseUrlChange) {
      onLocalLlmBaseUrlChange(localStateLlmBaseUrl);
    } else {
      void SettingsService.setLocalLlmBaseUrl(localStateLlmBaseUrl);
    }
  };

  // Sync local state when props or stored settings change (e.g., when modal opens with saved values)
  useEffect(() => {
    const sync = () => {
      setLocalGeminiApiKey(resolvedGeminiApiKey);
      setLocalOpenAiApiKey(resolvedOpenAiApiKey);
      setLocalClaudeApiKey(resolvedClaudeApiKey);
      setLocalStateLlmApiKey(resolvedLocalLlmApiKey);
      setLocalStateLlmModel(resolvedLocalLlmModel);
      setLocalStateLlmBaseUrl(resolvedLocalLlmBaseUrl);
    };

    sync();
  }, [
    resolvedGeminiApiKey,
    resolvedOpenAiApiKey,
    resolvedClaudeApiKey,
    resolvedLocalLlmApiKey,
    resolvedLocalLlmModel,
    resolvedLocalLlmBaseUrl,
  ]);

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
      onValueChange: handleEnableLocalLlmWithThinking,
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

  const claudeToggleItems = [
    {
      key: 'enable-claude',
      label: t('settings.aiSettings.enableClaude'),
      value: debouncedEnableClaude,
      onValueChange: handleEnableClaudeChange,
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
    selected: model.model === resolvedGeminiModel,
    title: model.model,
    description: `Google Gemini ${model.model}`,
    onPress: () => {
      if (onGeminiModelPress) {
        onGeminiModelPress(model.model);
      } else {
        void SettingsService.setGoogleGeminiModel(model.model);
      }
    },
  }));

  const openAiModelMenuItems: BottomPopUpMenuItem[] = Object.values(OPENAI_MODELS).map((model) => ({
    icon: Bot,
    selected: model.model === resolvedOpenAiModel,
    title: model.model,
    description: `OpenAI ${model.model}`,
    onPress: () => {
      if (onOpenAiModelPress) {
        onOpenAiModelPress(model.model);
      } else {
        void SettingsService.setOpenAiModel(model.model);
      }
    },
  }));

  const claudeModelMenuItems: BottomPopUpMenuItem[] = Object.values(CLAUDE_MODELS).map((model) => ({
    icon: Bot,
    selected: model.model === resolvedClaudeModel,
    title: model.model,
    description: `Anthropic ${model.model}`,
    onPress: () => {
      if (onClaudeModelPress) {
        onClaudeModelPress(model.model);
      } else {
        void SettingsService.set(SETTINGS.claudeModel, model.model);
      }
    },
  }));

  const modelMenuConfigs: Record<
    ModelMenuKey,
    { title: string; subtitle: string; items: BottomPopUpMenuItem[] }
  > = {
    gemini: {
      title: t('settings.aiSettings.selectGeminiModel'),
      subtitle: t('settings.aiSettings.selectGeminiModelSubtitle'),
      items: geminiModelMenuItems,
    },
    openai: {
      title: t('settings.aiSettings.selectOpenAiModel'),
      subtitle: t('settings.aiSettings.selectOpenAiModelSubtitle'),
      items: openAiModelMenuItems,
    },
    claude: {
      title: t('settings.aiSettings.selectClaudeModel'),
      subtitle: t('settings.aiSettings.selectClaudeModelSubtitle'),
      items: claudeModelMenuItems,
    },
  };
  const currentModelMenu = activeModelMenu ? modelMenuConfigs[activeModelMenu] : null;

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={t('settings.aiSettings.title')}>
      <View className="gap-6 px-4 py-6" style={{ minHeight: '100%' }}>
        {/* Musclog Iron: renders nothing while Premium is switched off in this build. */}
        <PremiumCard onPress={() => setPremiumVisible(true)} />

        {/* Musclog Free Tier Section — hidden on web production builds (CORS/quota constraints) */}
        {musclogGatewayAvailable ? (
          <View className="gap-3">
            <Text
              className="px-5 text-xs font-semibold"
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
                  onValueChange: (value: boolean) => {
                    if (needsFreeTierConsent(debouncedUseMusclogFreeTier, value)) {
                      setFreeTierConsentVisible(true);
                    } else {
                      handleUseMusclogFreeTierChange(value);
                    }
                  },
                },
              ]}
            />
            {useMusclogGateway ? (
              <Text className="px-5 text-xs" style={{ color: theme.colors.text.tertiary }}>
                {t('settings.aiSettings.musclogFreeTier.activeNote')}
              </Text>
            ) : null}
          </View>
        ) : null}

        {isMusclogIronActive ? (
          <Text className="px-5 text-xs" style={{ color: theme.colors.text.tertiary }}>
            {t('settings.aiSettings.premium.activeNote')}
          </Text>
        ) : null}

        {/* Provider sections (dimmed when free tier is active) */}
        <View
          style={{ opacity: useMusclogGateway ? 0.4 : 1 }}
          pointerEvents={useMusclogGateway ? 'none' : 'auto'}
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
              onTestKey={() => testApiKey('gemini', localGeminiApiKey)}
              hasUnsavedChanges={hasGeminiKeyChanges}
              modelLabel={t('settings.aiSettings.geminiModel')}
              modelValue={resolvedGeminiModel}
              onModelPress={() => setActiveModelMenu('gemini')}
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
              onTestKey={() => testApiKey('openai', localOpenAiApiKey)}
              hasUnsavedChanges={hasOpenAiKeyChanges}
              modelLabel={t('settings.aiSettings.openAiModel')}
              modelValue={resolvedOpenAiModel}
              onModelPress={() => setActiveModelMenu('openai')}
              modelFallbackText={t('settings.aiSettings.selectModel')}
            />

            {/* Anthropic Claude Integration Section */}
            <AIIntegrationCard
              sectionTitle={t('settings.aiSettings.claudeIntegration')}
              sectionTitleColor={theme.colors.accent.primary}
              toggleItems={claudeToggleItems}
              enabled={debouncedEnableClaude}
              apiKeyLabel={t('settings.aiSettings.claudeApiKey')}
              apiKeyValue={localClaudeApiKey}
              onApiKeyChange={setLocalClaudeApiKey}
              apiKeyPlaceholder={t('settings.aiSettings.apiKeyPlaceholder')}
              onSaveApiKey={handleSaveClaudeApiKey}
              onTestKey={() => testApiKey('claude', localClaudeApiKey)}
              hasUnsavedChanges={hasClaudeKeyChanges}
              modelLabel={t('settings.aiSettings.claudeModel')}
              modelValue={resolvedClaudeModel}
              onModelPress={() => setActiveModelMenu('claude')}
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

            <OnDeviceAiSection
              hostedProviderActive={isMusclogIronActive || debouncedUseMusclogFreeTier}
            />
          </View>
        </View>

        {/* Everything around the providers (thinking, memory, photos, persona, prompts) lives on its own screen. */}
        <ListRow
          variant="card"
          title={t('settings.aiBehavior.title')}
          subtitle={t('settings.aiBehavior.subtitle')}
          onPress={() => setBehaviorVisible(true)}
          leading={
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
          }
        />

        <LegalLinksCard />

        {/* Model Selection Menu */}
        <BottomPopUpMenu
          visible={currentModelMenu !== null}
          onClose={() => setActiveModelMenu(null)}
          title={currentModelMenu?.title ?? ''}
          subtitle={currentModelMenu?.subtitle ?? ''}
          items={currentModelMenu?.items ?? []}
        />

        {/* Inside this FullScreenModal's tree, and never open together with a menu. */}
        {/* eslint-disable-next-line local/no-sibling-modals */}
        <ConfirmationModal
          visible={freeTierConsentVisible}
          onClose={() => setFreeTierConsentVisible(false)}
          onConfirm={() => {
            setFreeTierConsentVisible(false);
            handleUseMusclogFreeTierChange(true);
          }}
          title={t('settings.aiSettings.musclogFreeTier.consentTitle')}
          message={t('settings.aiSettings.musclogFreeTier.consentBody')}
          confirmLabel={t('settings.aiSettings.musclogFreeTier.consentConfirm')}
        />
      </View>

      {/* Opened only from the AI behavior row, never while a menu or the consent modal is open. */}
      <AIBehaviorSettingsModal
        visible={behaviorVisible}
        onClose={() => setBehaviorVisible(false)}
      />

      {/* Opened only from the Premium card at the top, never while a menu or the consent modal is open. */}
      <PremiumModal visible={premiumVisible} onClose={() => setPremiumVisible(false)} />
    </FullScreenModal>
  );
}
