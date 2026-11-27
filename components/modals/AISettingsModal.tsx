import { Bot, ChevronDown, Settings2 } from 'lucide-react-native';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, View } from 'react-native';

import { AiOutputNotice } from '@/components/ai/AiOutputNotice';
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
import { useAiConsentGate } from '@/hooks/useAiConsentGate';
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
import { AiProviderConsentModal } from './AiProviderConsentModal';
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
};

type OwnKeyProvider = 'gemini' | 'openai' | 'claude';

// Everything that differs between the three own-key providers. Translation keys are whole
// literals so scripts/check-translations.js can see them.
const OWN_KEY_PROVIDERS = {
  gemini: {
    sectionTitle: 'settings.aiSettings.googleGeminiIntegration',
    apiKeyLabel: 'settings.aiSettings.googleGeminiApiKey',
    apiKeyHelper: 'settings.aiSettings.apiKeyHelper',
    toggleLabel: 'settings.aiSettings.enableGoogleGemini',
    modelLabel: 'settings.aiSettings.geminiModel',
    modelFallbackText: undefined,
    menuTitle: 'settings.aiSettings.selectGeminiModel',
    menuSubtitle: 'settings.aiSettings.selectGeminiModelSubtitle',
    modelDescriptionPrefix: 'Google Gemini',
    models: GEMINI_MODELS,
    iconTint: 'info',
    iconSize: 'lg',
    saveKey: (key: string) => SettingsService.setGoogleGeminiApiKey(key),
    selectModel: (model: string) => SettingsService.setGoogleGeminiModel(model),
  },
  openai: {
    sectionTitle: 'settings.aiSettings.openAiIntegration',
    apiKeyLabel: 'settings.aiSettings.openAiApiKey',
    apiKeyHelper: undefined,
    toggleLabel: 'settings.aiSettings.enableOpenAi',
    modelLabel: 'settings.aiSettings.openAiModel',
    modelFallbackText: 'settings.aiSettings.selectModel',
    menuTitle: 'settings.aiSettings.selectOpenAiModel',
    menuSubtitle: 'settings.aiSettings.selectOpenAiModelSubtitle',
    modelDescriptionPrefix: 'OpenAI',
    models: OPENAI_MODELS,
    iconTint: 'indigo',
    iconSize: 'md',
    saveKey: (key: string) => SettingsService.setOpenAiApiKey(key),
    selectModel: (model: string) => SettingsService.setOpenAiModel(model),
  },
  claude: {
    sectionTitle: 'settings.aiSettings.claudeIntegration',
    apiKeyLabel: 'settings.aiSettings.claudeApiKey',
    apiKeyHelper: undefined,
    toggleLabel: 'settings.aiSettings.enableClaude',
    modelLabel: 'settings.aiSettings.claudeModel',
    modelFallbackText: 'settings.aiSettings.selectModel',
    menuTitle: 'settings.aiSettings.selectClaudeModel',
    menuSubtitle: 'settings.aiSettings.selectClaudeModelSubtitle',
    modelDescriptionPrefix: 'Anthropic',
    models: CLAUDE_MODELS,
    iconTint: 'indigo',
    iconSize: 'md',
    saveKey: (key: string) => SettingsService.setClaudeApiKey(key),
    selectModel: (model: string) => SettingsService.set(SETTINGS.claudeModel, model),
  },
} as const;

const OWN_KEY_PROVIDER_ORDER: readonly OwnKeyProvider[] = ['gemini', 'openai', 'claude'];

export function AISettingsModal({ visible, onClose }: AISettingsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const settings = useSettings();
  const [activeModelMenu, setActiveModelMenu] = useSubModalState<OwnKeyProvider | null>(
    visible,
    null
  );
  const [behaviorVisible, setBehaviorVisible] = useState(false);
  // Asked before any option starts receiving data: a switch turned on, or a key saved.
  const consent = useAiConsentGate();
  const [premiumVisible, setPremiumVisible] = useState(false);
  // Loads the overview while this screen is open; `PremiumCard` below reads the same store.
  const premium = usePremium({ load: visible });
  const isMusclogIronActive =
    premium.enabled && premium.view.phase === 'active' && premium.useHostedAi;

  const savedKeys: Record<OwnKeyProvider, string> = {
    gemini: settings.googleGeminiApiKey ?? '',
    openai: settings.openAiApiKey ?? '',
    claude: settings.claudeApiKey ?? '',
  };
  const savedModels: Record<OwnKeyProvider, string> = {
    gemini: settings.googleGeminiModel ?? DEFAULT_GEMINI_MODEL,
    openai: settings.openAiModel ?? DEFAULT_OPENAI_MODEL,
    claude: settings.claudeModel ?? DEFAULT_CLAUDE_MODEL,
  };
  const resolvedLocalLlmApiKey = settings.localLlmApiKey ?? '';
  const resolvedLocalLlmModel = settings.localLlmModel ?? 'llama3';
  const resolvedLocalLlmBaseUrl = settings.localLlmBaseUrl ?? 'http://localhost:11434/v1';

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
  const [localKeys, setLocalKeys] = useState<Record<OwnKeyProvider, string>>(savedKeys);
  const [localStateLlmApiKey, setLocalStateLlmApiKey] = useState(resolvedLocalLlmApiKey);
  const [localStateLlmModel, setLocalStateLlmModel] = useState(resolvedLocalLlmModel);
  const [localStateLlmBaseUrl, setLocalStateLlmBaseUrl] = useState(resolvedLocalLlmBaseUrl);

  const setLocalKey = (provider: OwnKeyProvider, value: string) => {
    setLocalKeys((previous) => ({ ...previous, [provider]: value }));
  };

  // Track if there are unsaved changes
  const hasLocalLlmChanges =
    localStateLlmApiKey !== resolvedLocalLlmApiKey ||
    localStateLlmModel !== resolvedLocalLlmModel ||
    localStateLlmBaseUrl !== resolvedLocalLlmBaseUrl;

  // Save handlers
  // The own-provider switches start on, so saving a key is often what turns the provider on.
  const saveOwnKey = (provider: OwnKeyProvider) => {
    const key = localKeys[provider];
    const save = () => {
      void OWN_KEY_PROVIDERS[provider].saveKey(key);
    };

    if (key.trim()) {
      consent.request(provider, save);
    } else {
      save();
    }
  };

  const saveLocalLlmConfig = () => {
    void SettingsService.setLocalLlmApiKey(localStateLlmApiKey);
    void SettingsService.setLocalLlmModel(localStateLlmModel);
    void SettingsService.setLocalLlmBaseUrl(localStateLlmBaseUrl);
  };

  const handleSaveLocalLlmConfig = () => {
    if (debouncedEnableLocalLlm) {
      consent.request('local', saveLocalLlmConfig);
    } else {
      // Nothing is sent while the local server is off; turning it on asks.
      saveLocalLlmConfig();
    }
  };

  // Sync local state when stored settings change (e.g., when modal opens with saved values)
  useEffect(() => {
    const sync = () => {
      setLocalKeys({
        gemini: savedKeys.gemini,
        openai: savedKeys.openai,
        claude: savedKeys.claude,
      });
      setLocalStateLlmApiKey(resolvedLocalLlmApiKey);
      setLocalStateLlmModel(resolvedLocalLlmModel);
      setLocalStateLlmBaseUrl(resolvedLocalLlmBaseUrl);
    };

    sync();
  }, [
    savedKeys.gemini,
    savedKeys.openai,
    savedKeys.claude,
    resolvedLocalLlmApiKey,
    resolvedLocalLlmModel,
    resolvedLocalLlmBaseUrl,
  ]);

  const ownKeyEnabled: Record<OwnKeyProvider, boolean> = {
    gemini: debouncedEnableGoogleGemini,
    openai: debouncedEnableOpenAi,
    claude: debouncedEnableClaude,
  };
  const ownKeyEnableHandlers: Record<OwnKeyProvider, (enabled: boolean) => void> = {
    gemini: handleEnableGoogleGeminiChange,
    openai: handleEnableOpenAiChange,
    claude: handleEnableClaudeChange,
  };

  const ownKeyToggleItem = (provider: OwnKeyProvider) => {
    const config = OWN_KEY_PROVIDERS[provider];
    const tint =
      config.iconTint === 'info'
        ? { background: theme.colors.status.info10, foreground: theme.colors.status.info }
        : { background: theme.colors.status.indigo10, foreground: theme.colors.status.indigo };

    return {
      key: `enable-${provider}`,
      label: t(config.toggleLabel),
      value: ownKeyEnabled[provider],
      onValueChange: (value: boolean) => {
        if (value) {
          consent.request(provider, () => ownKeyEnableHandlers[provider](true));
        } else {
          ownKeyEnableHandlers[provider](false);
        }
      },
      icon: (
        <View
          style={{
            width: theme.size['8'],
            height: theme.size['8'],
            borderRadius: theme.borderRadius.full / 2,
            backgroundColor: tint.background,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bot
            size={config.iconSize === 'lg' ? theme.iconSize.lg : theme.iconSize.md}
            color={tint.foreground}
          />
        </View>
      ),
    };
  };

  const localLlmToggleItems = [
    {
      key: 'enable-local-llm',
      label: t('settings.aiSettings.enableLocalLlm'),
      value: debouncedEnableLocalLlm,
      onValueChange: (value: boolean) => {
        if (value) {
          consent.request('local', () => handleEnableLocalLlmWithThinking(true));
        } else {
          handleEnableLocalLlmWithThinking(false);
        }
      },
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

  const ownKeyModelMenuItems = (provider: OwnKeyProvider): BottomPopUpMenuItem[] => {
    const config = OWN_KEY_PROVIDERS[provider];
    const models: readonly { model: string }[] = Object.values(config.models);

    return models.map((model) => ({
      icon: Bot,
      selected: model.model === savedModels[provider],
      title: model.model,
      description: `${config.modelDescriptionPrefix} ${model.model}`,
      onPress: () => {
        void config.selectModel(model.model);
      },
    }));
  };

  const currentModelMenu = activeModelMenu
    ? {
        title: t(OWN_KEY_PROVIDERS[activeModelMenu].menuTitle),
        subtitle: t(OWN_KEY_PROVIDERS[activeModelMenu].menuSubtitle),
        items: ownKeyModelMenuItems(activeModelMenu),
      }
    : null;

  const ownKeyCard = (provider: OwnKeyProvider) => {
    const config = OWN_KEY_PROVIDERS[provider];

    return (
      <AIIntegrationCard
        key={provider}
        sectionTitle={t(config.sectionTitle)}
        sectionTitleColor={theme.colors.accent.primary}
        toggleItems={[ownKeyToggleItem(provider)]}
        enabled={ownKeyEnabled[provider]}
        apiKeyLabel={t(config.apiKeyLabel)}
        apiKeyValue={localKeys[provider]}
        onApiKeyChange={(value) => setLocalKey(provider, value)}
        apiKeyPlaceholder={t('settings.aiSettings.apiKeyPlaceholder')}
        apiKeyHelper={config.apiKeyHelper ? t(config.apiKeyHelper) : undefined}
        onSaveApiKey={() => saveOwnKey(provider)}
        onTestKey={() => testApiKey(provider, localKeys[provider])}
        hasUnsavedChanges={localKeys[provider] !== savedKeys[provider]}
        modelLabel={t(config.modelLabel)}
        modelValue={savedModels[provider]}
        onModelPress={() => setActiveModelMenu(provider)}
        modelFallbackText={config.modelFallbackText ? t(config.modelFallbackText) : undefined}
      />
    );
  };

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={t('settings.aiSettings.title')}>
      <View className="gap-6 px-4 py-6" style={{ minHeight: '100%' }}>
        <AiOutputNotice kind="settings" />

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
                      consent.request('gateway', () => handleUseMusclogFreeTierChange(true));
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
            {OWN_KEY_PROVIDER_ORDER.map(ownKeyCard)}

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
        <AiProviderConsentModal
          provider={consent.provider}
          onClose={consent.cancel}
          onConfirm={consent.confirm}
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
