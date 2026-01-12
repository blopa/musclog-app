import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Bot, Link, ChevronDown, Apple, Dumbbell } from 'lucide-react-native';
import { FullScreenModal } from './FullScreenModal';
import { SecretInput } from '../theme/SecretInput';
import { ToggleInput } from '../theme/ToggleInput';
import { theme } from '../../theme';

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
  const [openAiKeyVisible, setOpenAiKeyVisible] = useState(false);

  const geminiToggleItems = [
    {
      key: 'enable-gemini',
      label: 'Enable Google Gemini',
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
      label: 'Daily Nutrition Insights',
      subtitle: 'Morning summary based on logs',
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
      label: 'Workout Insights',
      subtitle: 'Post-workout analysis',
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
      label: 'Enable OpenAI',
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
    <FullScreenModal visible={visible} onClose={onClose} title="AI Settings">
      <View className="gap-6 px-4 py-6" style={{ minHeight: '100%' }}>
        {/* Google Gemini Integration Section */}
        <View>
          <Text
            className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.accent.primary }}>
            GOOGLE GEMINI INTEGRATION
          </Text>

          {/* Toggle Block */}
          <ToggleInput items={geminiToggleItems} />

          {/* Settings Block */}
          <View
            style={{
              backgroundColor: theme.colors.background.card,
              borderRadius: theme.borderRadius.lg,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.border.light,
              overflow: 'hidden',
            }}>
            {/* Connect Button */}
            <View
              style={{
                padding: theme.spacing.padding.base,
                borderBottomWidth: theme.borderWidth.thin,
                borderBottomColor: theme.colors.border.light,
              }}>
              <Pressable
                onPress={onConnectGoogleAccount}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: theme.spacing.gap.sm,
                    height: theme.size['12'],
                    borderRadius: theme.borderRadius.md,
                    backgroundColor: theme.colors.background.cardElevated,
                    borderWidth: theme.borderWidth.thin,
                    borderColor: theme.colors.border.light,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}>
                <Link size={theme.iconSize.lg} color={theme.colors.text.primary} />
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.bold,
                    letterSpacing: 0.5,
                    color: theme.colors.text.primary,
                  }}>
                  Connect Google Account
                </Text>
              </Pressable>
            </View>

            {/* API Key Input */}
            <View
              style={{
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border.light,
              }}>
              <SecretInput
                label="GOOGLE GEMINI API KEY"
                value={googleGeminiApiKey}
                onChangeText={onGoogleGeminiApiKeyChange || (() => {})}
                placeholder="Paste your API key here"
              />
              <Text
                style={{
                  fontSize: theme.typography.fontSize['10'],
                  color: theme.colors.text.tertiary,
                  marginTop: theme.spacing.padding.sm,
                  marginLeft: theme.spacing.padding.xs,
                }}>
                Leaving this blank will use the connected account quota.
              </Text>
            </View>

            {/* Model Selector */}
            <Pressable
              onPress={onGeminiModelPress}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  backgroundColor: pressed ? theme.colors.background.overlay : undefined,
                },
              ]}>
              <View>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.medium,
                    color: theme.colors.text.primary,
                  }}>
                  Gemini Model
                </Text>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.accent.primary,
                    marginTop: theme.spacing.padding.xs / 2,
                  }}>
                  {geminiModel}
                </Text>
              </View>
              <ChevronDown size={20} color={theme.colors.text.tertiary} />
            </Pressable>
          </View>
        </View>

        {/* OpenAI Integration Section */}
        <View>
          <Text
            className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.status.indigoLight }}>
            OPENAI INTEGRATION
          </Text>
          {/* OpenAI Enable Toggle */}
          <ToggleInput items={openAiToggleItems} />
          <View
            style={{
              backgroundColor: theme.colors.background.card,
              borderRadius: theme.borderRadius.lg,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.border.light,
              overflow: 'hidden',
            }}>
            {/* API Key Input */}
            <View
              style={{
                padding: theme.spacing.padding.base,
                borderBottomWidth: theme.borderWidth.thin,
                borderBottomColor: theme.colors.border.light,
              }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: theme.spacing.padding.sm,
                }}></View>
              <SecretInput
                label="OPENAI API KEY"
                value={openAiApiKey}
                onChangeText={onOpenAiApiKeyChange || (() => {})}
                placeholder="Paste your API key here"
              />
            </View>

            {/* Model Selector */}
            <Pressable
              onPress={onOpenAiModelPress}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  backgroundColor: pressed ? theme.colors.background.overlay : undefined,
                },
              ]}>
              <View>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.medium,
                    color: theme.colors.text.primary,
                  }}>
                  OpenAI Model
                </Text>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.accent.primary,
                    marginTop: theme.spacing.padding.xs / 2,
                  }}>
                  {openAiModel || 'Select a model'}
                </Text>
              </View>
              <ChevronDown size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
            </Pressable>
          </View>
        </View>

        {/* Insights & Alerts Section */}
        <View>
          <Text
            className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.text.secondary }}>
            INSIGHTS & ALERTS
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
            Need help finding your API keys?{' '}
            <Text
              style={{
                color: theme.colors.accent.primary,
                textDecorationLine: 'underline',
                textDecorationStyle: 'dotted',
              }}
              onPress={() => {
                // Handle setup guide link
              }}>
              Read the setup guide
            </Text>
            .
          </Text>
          <Text
            style={{
              fontSize: theme.typography.fontSize['10'],
              color: theme.colors.text.tertiary,
              textAlign: 'center',
              marginTop: theme.spacing.padding['6'],
            }}>
            Musclog AI v{version}
          </Text>
        </View>
      </View>
    </FullScreenModal>
  );
}
