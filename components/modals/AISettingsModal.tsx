import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Bot, Link, ChevronDown, Apple, Dumbbell } from 'lucide-react-native';
import { FullScreenModal } from './FullScreenModal';
import { SecretInput } from '../theme/SecretInput';
import { ToggleInput } from '../theme/ToggleInput';
import { GoogleSignInButton } from '../GoogleSignInButton';
import { theme } from '../../theme';

type AIIntegrationCardProps = {
  sectionTitle: string;
  sectionTitleColor: string;
  toggleItems: {
    key: string;
    label: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    icon?: React.ReactNode;
    subtitle?: string;
  }[];
  headerContent?: React.ReactNode;
  apiKeyLabel: string;
  apiKeyValue: string;
  onApiKeyChange: (value: string) => void;
  apiKeyPlaceholder: string;
  apiKeyHelper?: string;
  modelLabel: string;
  modelValue: string;
  onModelPress?: () => void;
  modelFallbackText?: string;
};

function AIIntegrationCard({
  sectionTitle,
  sectionTitleColor,
  toggleItems,
  headerContent,
  apiKeyLabel,
  apiKeyValue,
  onApiKeyChange,
  apiKeyPlaceholder,
  apiKeyHelper,
  modelLabel,
  modelValue,
  onModelPress,
  modelFallbackText,
}: AIIntegrationCardProps) {
  return (
    <View>
      <Text
        className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
        style={{ color: sectionTitleColor }}>
        {sectionTitle}
      </Text>

      {/* Toggle Block */}
      <ToggleInput items={toggleItems} />

      {/* Settings Block */}
      <View
        style={{
          backgroundColor: theme.colors.background.card,
          borderRadius: theme.borderRadius.lg,
          borderWidth: theme.borderWidth.thin,
          borderColor: theme.colors.border.light,
          overflow: 'hidden',
        }}>
        {/* Optional Header Content (e.g., Connect Button) */}
        {headerContent && (
          <View
            className="w-full items-center"
            style={{
              padding: theme.spacing.padding.base,
              borderBottomWidth: theme.borderWidth.thin,
              borderBottomColor: theme.colors.border.light,
            }}>
            {headerContent}
          </View>
        )}

        {/* API Key Input */}
        <View
          style={{
            padding: theme.spacing.padding.base,
            borderBottomWidth: theme.borderWidth.thin,
            borderBottomColor: theme.colors.border.light,
          }}>
          <SecretInput
            label={apiKeyLabel}
            value={apiKeyValue}
            onChangeText={onApiKeyChange}
            placeholder={apiKeyPlaceholder}
          />
          {apiKeyHelper && (
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                marginTop: theme.spacing.padding.sm,
                marginLeft: theme.spacing.padding.xs,
              }}>
              {apiKeyHelper}
            </Text>
          )}
        </View>

        {/* Model Selector */}
        <Pressable
          onPress={onModelPress}
          className="flex-row items-center justify-between p-4 active:bg-bg-overlay">
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-medium text-text-primary">{modelLabel}</Text>
            <Text
              className="text-xs text-accent-primary"
              style={{
                marginTop: theme.spacing.padding.xsHalf,
              }}>
              {modelValue || modelFallbackText}
            </Text>
          </View>
          <ChevronDown size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
        </Pressable>
      </View>
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
  onGeminiModelPress?: () => void;
  // OpenAI
  openAiApiKey?: string;
  onOpenAiApiKeyChange?: (value: string) => void;
  onGetOpenAiKeyPress?: () => void;
  openAiModel?: string;
  onOpenAiModelPress?: () => void;
  enableOpenAi?: boolean;
  onEnableOpenAiChange?: (value: boolean) => void;
  // Insights & Alerts
  dailyNutritionInsights?: boolean;
  onDailyNutritionInsightsChange?: (value: boolean) => void;
  workoutInsights?: boolean;
  onWorkoutInsightsChange?: (value: boolean) => void;
  // Version
  version?: string;
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
  version = '2.4.1',
}: AISettingsModalProps) {
  const { t } = useTranslation();
  const [openAiKeyVisible, setOpenAiKeyVisible] = useState(false);

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
          }}>
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
          }}>
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
          }}>
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
          }}>
          <Bot size={theme.iconSize.md} color={theme.colors.status.indigo} />
        </View>
      ),
    },
  ];

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={t('settings.aiSettings.title')}>
      <View className="gap-6 px-4 py-6" style={{ minHeight: '100%' }}>
        {/* Google Gemini Integration Section */}
        <AIIntegrationCard
          sectionTitle={t('settings.aiSettings.googleGeminiIntegration')}
          sectionTitleColor={theme.colors.accent.primary}
          toggleItems={geminiToggleItems}
          headerContent={<GoogleSignInButton onPress={onConnectGoogleAccount} variant="dark" />}
          apiKeyLabel={t('settings.aiSettings.googleGeminiApiKey')}
          apiKeyValue={googleGeminiApiKey}
          onApiKeyChange={onGoogleGeminiApiKeyChange || (() => {})}
          apiKeyPlaceholder={t('settings.aiSettings.apiKeyPlaceholder')}
          apiKeyHelper={t('settings.aiSettings.apiKeyHelper')}
          modelLabel={t('settings.aiSettings.geminiModel')}
          modelValue={geminiModel}
          onModelPress={onGeminiModelPress}
        />

        {/* OpenAI Integration Section */}
        <AIIntegrationCard
          sectionTitle={t('settings.aiSettings.openAiIntegration')}
          sectionTitleColor={theme.colors.status.indigoLight}
          toggleItems={openAiToggleItems}
          apiKeyLabel={t('settings.aiSettings.openAiApiKey')}
          apiKeyValue={openAiApiKey}
          onApiKeyChange={onOpenAiApiKeyChange || (() => {})}
          apiKeyPlaceholder={t('settings.aiSettings.apiKeyPlaceholder')}
          modelLabel={t('settings.aiSettings.openAiModel')}
          modelValue={openAiModel}
          onModelPress={onOpenAiModelPress}
          modelFallbackText={t('settings.aiSettings.selectModel')}
        />

        {/* Insights & Alerts Section */}
        <View>
          <Text
            className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.text.secondary }}>
            {t('settings.aiSettings.insightsAlerts')}
          </Text>
          <ToggleInput items={insightsItems} />
        </View>

        {/* Footer Help */}
        <View
          style={{
            marginTop: theme.spacing.padding.base,
            paddingHorizontal: theme.spacing.padding.base,
          }}>
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.tertiary,
              textAlign: 'center',
              lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.xs,
            }}>
            {t('settings.aiSettings.apiKeyHelp')}{' '}
            <Text
              style={{
                color: theme.colors.accent.primary,
                textDecorationLine: 'underline',
                textDecorationStyle: 'dotted',
              }}
              onPress={() => {
                // Handle setup guide link
              }}>
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
            }}>
            {t('settings.aiSettings.version', { version })}
          </Text>
        </View>
      </View>
    </FullScreenModal>
  );
}
