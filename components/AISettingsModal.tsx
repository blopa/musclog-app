import React, { useState } from 'react';
import { View, Text, Pressable, TextInput as RNTextInput } from 'react-native';
import {
  Bot,
  Link,
  Key,
  ChevronDown,
  ChevronRight,
  Apple,
  Dumbbell,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import { FullScreenModal } from './FullScreenModal';
import { SecretInput } from './theme/SecretInput';
import { TogglableSettings } from './TogglableSettings';
import { theme } from '../theme';

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
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Bot size={20} color="#3b82f6" />
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
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Apple size={18} color={theme.colors.accent.primary} />
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
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(249, 115, 22, 0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Dumbbell size={18} color="#f97316" />
        </View>
      ),
    },
  ];

  return (
    <FullScreenModal visible={visible} onClose={onClose} title="AI Settings">
      <View className="gap-6 px-4 py-6">
        {/* Google Gemini Integration Section */}
        <View>
          <Text
            className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.accent.primary }}>
            GOOGLE GEMINI INTEGRATION
          </Text>

          {/* Toggle Block */}
          <TogglableSettings items={geminiToggleItems} />

          {/* Settings Block */}
          <View
            style={{
              backgroundColor: theme.colors.background.card,
              borderRadius: 16,
              marginHorizontal: 16,
              borderWidth: 1,
              borderColor: theme.colors.border.light,
              overflow: 'hidden',
            }}>
            {/* Connect Button */}
            <View
              style={{
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border.light,
              }}>
              <Pressable
                onPress={onConnectGoogleAccount}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: theme.colors.background.cardElevated,
                    borderWidth: 1,
                    borderColor: theme.colors.border.light,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}>
                <Link size={20} color={theme.colors.text.primary} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
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
                  fontSize: 10,
                  color: theme.colors.text.tertiary,
                  marginTop: 8,
                  marginLeft: 4,
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
                <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.text.primary }}>
                  Gemini Model
                </Text>
                <Text style={{ fontSize: 12, color: theme.colors.accent.primary, marginTop: 2 }}>
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
            style={{ color: '#818cf8' }}>
            OPENAI INTEGRATION
          </Text>
          <View
            style={{
              backgroundColor: theme.colors.background.card,
              borderRadius: 16,
              marginHorizontal: 16,
              borderWidth: 1,
              borderColor: theme.colors.border.light,
              overflow: 'hidden',
            }}>
            {/* API Key Input */}
            <View
              style={{
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border.light,
              }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
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
                <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.text.primary }}>
                  OpenAI Model
                </Text>
                <Text style={{ fontSize: 12, color: theme.colors.accent.primary, marginTop: 2 }}>
                  {openAiModel || 'Select a model'}
                </Text>
              </View>
              <ChevronDown size={20} color={theme.colors.text.tertiary} />
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
          <TogglableSettings items={insightsItems} />
        </View>

        {/* Footer Help */}
        <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
          <Text
            style={{
              fontSize: 12,
              color: theme.colors.text.tertiary,
              textAlign: 'center',
              lineHeight: 18,
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
              fontSize: 10,
              color: theme.colors.text.tertiary,
              textAlign: 'center',
              marginTop: 24,
            }}>
            Musclog AI v{version}
          </Text>
        </View>
      </View>
    </FullScreenModal>
  );
}
