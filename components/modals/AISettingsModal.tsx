import { Apple, Bot, ChevronDown, Dumbbell } from 'lucide-react-native';
import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { GEMINI_MODELS, OPENAI_MODELS } from '../../constants/ai';
import packageJson from '../../package.json';
import { theme } from '../../theme';
import { BottomPopUpMenu, type BottomPopUpMenuItem } from '../BottomPopUpMenu';
import { GoogleSignInButton } from '../GoogleSignInButton';
import { Button } from '../theme/Button';
import { SecretInput } from '../theme/SecretInput';
import { ToggleInput } from '../theme/ToggleInput';
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
}: AIIntegrationCardProps) {
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
                label={hasUnsavedChanges ? t('save') : t('saved')}
                onPress={onSaveApiKey}
                disabled={!hasUnsavedChanges}
                size="sm"
                width="full"
                variant={hasUnsavedChanges ? 'accent' : 'outline'}
              />
            </View>
          </View>

          {/* Model Selector */}
          <Pressable
            onPress={onModelPress}
            className="flex-row items-center justify-between p-4 active:bg-bg-overlay"
          >
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
            <ChevronDown size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
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
  enableGoogleGemini?: boolean;
  onEnableGoogleGeminiChange?: (value: boolean) => void;
  onConnectGoogleAccount?: () => void;
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
  enableOpenAi?: boolean;
  onEnableOpenAiChange?: (value: boolean) => void;
  // Insights & Alerts
  dailyNutritionInsights?: boolean;
  onDailyNutritionInsightsChange?: (value: boolean) => void;
  workoutInsights?: boolean;
  onWorkoutInsightsChange?: (value: boolean) => void;
};

export function AISettingsModal({
  visible,
  onClose,
  enableGoogleGemini = true,
  onEnableGoogleGeminiChange,
  onConnectGoogleAccount,
  googleGeminiApiKey = '',
  onGoogleGeminiApiKeyChange,
  geminiModel = 'Gemini Pro 1.5',
  onGeminiModelPress,
  openAiApiKey = '',
  onOpenAiApiKeyChange,
  onGetOpenAiKeyPress,
  openAiModel = 'GPT-4o',
  onOpenAiModelPress,
  enableOpenAi = true,
  onEnableOpenAiChange,
  dailyNutritionInsights = true,
  onDailyNutritionInsightsChange,
  workoutInsights = false,
  onWorkoutInsightsChange,
}: AISettingsModalProps) {
  const { t } = useTranslation();
  const [openAiKeyVisible, setOpenAiKeyVisible] = useState(false);
  const [geminiModelMenuVisible, setGeminiModelMenuVisible] = useState(false);
  const [openAiModelMenuVisible, setOpenAiModelMenuVisible] = useState(false);

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
      value: enableGoogleGemini,
      onValueChange: onEnableGoogleGeminiChange || (() => {}),
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
      value: dailyNutritionInsights,
      onValueChange: onDailyNutritionInsightsChange || (() => {}),
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
      value: workoutInsights,
      onValueChange: onWorkoutInsightsChange || (() => {}),
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
      value: enableOpenAi,
      onValueChange: onEnableOpenAiChange || (() => {}),
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
          enabled={enableGoogleGemini}
          headerContent={<GoogleSignInButton onPress={onConnectGoogleAccount} variant="dark" />}
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
          enabled={enableOpenAi}
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

        {/* Footer Help */}
        <View
          style={{
            marginTop: theme.spacing.padding.base,
            paddingHorizontal: theme.spacing.padding.base,
          }}
        >
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.tertiary,
              textAlign: 'center',
              lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.xs,
            }}
          >
            {t('settings.aiSettings.apiKeyHelp')}{' '}
            <Text
              style={{
                color: theme.colors.accent.primary,
                textDecorationLine: 'underline',
                textDecorationStyle: 'dotted',
              }}
              onPress={() => {
                // Handle setup guide link
              }}
            >
              {t('settings.aiSettings.setupGuide')}
            </Text>
            .
          </Text>
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.tertiary,
              textAlign: 'center',
              marginTop: theme.spacing.padding['6'],
            }}
          >
            {t('settings.aiSettings.version', { version: packageJson.version })}
          </Text>
        </View>

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
    </FullScreenModal>
  );
}
