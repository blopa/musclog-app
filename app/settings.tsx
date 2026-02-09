import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { SettingsCard } from '../components/cards/SettingsCard';
import { MasterLayout } from '../components/MasterLayout';
import { AdvancedSettingsModal } from '../components/modals/AdvancedSettingsModal';
import { AISettingsModal } from '../components/modals/AISettingsModal';
import { BasicSettingsModal } from '../components/modals/BasicSettingsModal';
import { ToggleInput } from '../components/theme/ToggleInput';
import { SettingsService } from '../database/services/SettingsService';
import { useSettings } from '../hooks/useSettings';
import packageJson from '../package.json';
import { theme } from '../theme';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    theme: themeValue,
    connectHealthData,
    readHealthData,
    writeHealthData,
    anonymousBugReport,
    googleGeminiApiKey,
    googleGeminiModel,
    openAiApiKey,
    openAiModel,
    enableGoogleGemini,
    enableOpenAi,
    dailyNutritionInsights,
    workoutInsights,
    notifications,
  } = useSettings();
  const [isAISettingsVisible, setAISettingsVisible] = useState(false);
  const [isBasicSettingsVisible, setBasicSettingsVisible] = useState(false);
  const [isAdvancedSettingsVisible, setAdvancedSettingsVisible] = useState(false);

  const handleThemeChange = async (newTheme: 'system' | 'light' | 'dark') => {
    await SettingsService.setTheme(newTheme);
  };

  const handleConnectHealthDataChange = async (value: boolean) => {
    await SettingsService.setConnectHealthData(value);
  };

  const handleReadHealthDataChange = async (value: boolean) => {
    await SettingsService.setReadHealthData(value);
  };

  const handleWriteHealthDataChange = async (value: boolean) => {
    await SettingsService.setWriteHealthData(value);
  };

  const handleAnonymousBugReportChange = async (value: boolean) => {
    await SettingsService.setAnonymousBugReport(value);
  };

  const handleGoogleGeminiApiKeyChange = async (value: string) => {
    await SettingsService.setGoogleGeminiApiKey(value);
  };

  const handleGoogleGeminiModelChange = async (value: string) => {
    await SettingsService.setGoogleGeminiModel(value);
  };

  const handleOpenAiApiKeyChange = async (value: string) => {
    await SettingsService.setOpenAiApiKey(value);
  };

  const handleOpenAiModelChange = async (value: string) => {
    await SettingsService.setOpenAiModel(value);
  };

  const handleEnableGoogleGeminiChange = async (value: boolean) => {
    await SettingsService.setEnableGoogleGemini(value);
  };

  const handleEnableOpenAiChange = async (value: boolean) => {
    await SettingsService.setEnableOpenAi(value);
  };

  const handleDailyNutritionInsightsChange = async (value: boolean) => {
    await SettingsService.setDailyNutritionInsights(value);
  };

  const handleWorkoutInsightsChange = async (value: boolean) => {
    await SettingsService.setWorkoutInsights(value);
  };

  const handleNotificationsChange = async (value: boolean) => {
    await SettingsService.setNotifications(value);
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <View className="border-b border-border-light bg-bg-primary">
        <View className="flex-row items-center gap-4 px-4 py-4">
          <Pressable
            className="-ml-2 rounded-full p-2"
            onPress={() => {
              router.push('/');
            }}
          >
            <ArrowLeft size={theme.iconSize.md} color={theme.colors.text.primary} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xl font-bold tracking-tight text-text-primary">
              {t('settings.title')}
            </Text>
          </View>
        </View>
      </View>
      <View
        style={{
          flex: 1,
          marginHorizontal: theme.spacing.padding.base,
        }}
      >
        <View style={{ height: theme.size['6'] }} />
        {/* Configuration Section */}
        <Text
          style={{
            marginLeft: theme.spacing.padding['5'],
            marginTop: theme.spacing.padding.sm,
            marginBottom: theme.spacing.padding.sm,
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: theme.typography.letterSpacing.extraWide,
          }}
        >
          {t('settings.configuration')}
        </Text>

        <SettingsCard
          icon={
            <MaterialIcons
              name="settings"
              size={theme.iconSize['2xl']}
              color={theme.colors.accent.primary}
            />
          }
          title={t('settings.basicSettings.title')}
          subtitle={t('settings.basicSettings.subtitle')}
          onPress={() => setBasicSettingsVisible(true)}
          rightIcon={
            <MaterialIcons
              name="chevron-right"
              size={theme.iconSize.xl}
              color={theme.colors.text.secondary}
            />
          }
        />

        <SettingsCard
          icon={
            <MaterialIcons
              name="tune"
              size={theme.iconSize['2xl']}
              color={theme.colors.accent.primary}
            />
          }
          title={t('settings.advancedSettings.title')}
          subtitle={t('settings.advancedSettings.subtitle')}
          onPress={() => setAdvancedSettingsVisible(true)}
          rightIcon={
            <MaterialIcons
              name="chevron-right"
              size={theme.iconSize.xl}
              color={theme.colors.text.secondary}
            />
          }
        />

        <SettingsCard
          icon={
            <MaterialIcons
              name="smart-toy"
              size={theme.iconSize['2xl']}
              color={theme.colors.accent.primary}
            />
          }
          title={t('settings.aiSettings.title')}
          subtitle={t('settings.aiSettings.subtitle')}
          onPress={() => setAISettingsVisible(true)}
          rightIcon={
            <MaterialIcons
              name="chevron-right"
              size={theme.iconSize.xl}
              color={theme.colors.text.secondary}
            />
          }
        />

        {/* Divider */}
        <View
          style={{
            height: theme.borderWidth.thin,
            backgroundColor: theme.colors.border.light,
            marginVertical: theme.spacing.padding.md,
          }}
        />

        <ToggleInput
          items={[
            {
              key: 'notifications',
              label: t('settings.notifications'),
              icon: (
                <MaterialIcons
                  name="notifications"
                  size={theme.iconSize.xl}
                  color={theme.colors.text.secondary}
                />
              ),
              value: notifications,
              onValueChange: handleNotificationsChange,
            },
          ]}
        />

        {/* Info Links */}
        <View
          style={{
            marginBottom: theme.spacing.padding.sm,
          }}
        >
          <Pressable
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: theme.borderRadius.md,
                paddingVertical: theme.spacing.padding.md,
                paddingHorizontal: theme.spacing.padding.base,
                backgroundColor: pressed ? theme.colors.background.overlay : 'transparent',
              },
            ]}
            onPress={() => {}}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.text.primary,
                fontWeight: theme.typography.fontWeight.medium,
              }}
            >
              {t('settings.aboutMusclog')}
            </Text>
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.secondary,
              }}
            >
              {packageJson.version}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: theme.borderRadius.md,
                paddingVertical: theme.spacing.padding.md,
                paddingHorizontal: theme.spacing.padding.base,
                backgroundColor: pressed ? theme.colors.background.overlay : 'transparent',
              },
            ]}
            onPress={() => {}}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.text.primary,
                fontWeight: theme.typography.fontWeight.medium,
              }}
            >
              {t('settings.privacyPolicy')}
            </Text>
          </Pressable>
        </View>
        <View style={{ height: theme.size['8'] }} />
      </View>

      <AISettingsModal
        visible={isAISettingsVisible}
        onClose={() => setAISettingsVisible(false)}
        enableGoogleGemini={enableGoogleGemini}
        onEnableGoogleGeminiChange={handleEnableGoogleGeminiChange}
        googleGeminiApiKey={googleGeminiApiKey}
        onGoogleGeminiApiKeyChange={handleGoogleGeminiApiKeyChange}
        geminiModel={googleGeminiModel}
        onGeminiModelPress={handleGoogleGeminiModelChange}
        openAiApiKey={openAiApiKey}
        onOpenAiApiKeyChange={handleOpenAiApiKeyChange}
        openAiModel={openAiModel}
        onOpenAiModelPress={handleOpenAiModelChange}
        enableOpenAi={enableOpenAi}
        onEnableOpenAiChange={handleEnableOpenAiChange}
        dailyNutritionInsights={dailyNutritionInsights}
        onDailyNutritionInsightsChange={handleDailyNutritionInsightsChange}
        workoutInsights={workoutInsights}
        onWorkoutInsightsChange={handleWorkoutInsightsChange}
      />
      <BasicSettingsModal
        visible={isBasicSettingsVisible}
        onClose={() => setBasicSettingsVisible(false)}
        themeValue={themeValue}
        onThemeChange={handleThemeChange}
        connectHealthData={connectHealthData}
        onConnectHealthDataChange={handleConnectHealthDataChange}
        readHealthData={readHealthData}
        onReadHealthDataChange={handleReadHealthDataChange}
        writeHealthData={writeHealthData}
        onWriteHealthDataChange={handleWriteHealthDataChange}
      />
      <AdvancedSettingsModal
        visible={isAdvancedSettingsVisible}
        onClose={() => setAdvancedSettingsVisible(false)}
        anonymousBugReport={anonymousBugReport}
        onAnonymousBugReportChange={handleAnonymousBugReportChange}
      />
    </MasterLayout>
  );
}
