import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ArrowLeft, ExternalLink } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { GenericCard } from '../components/cards/GenericCard';
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

const buildNumber =
  Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? null;

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    connectHealthData,
    readHealthData,
    writeHealthData,
    googleGeminiApiKey,
    googleGeminiModel,
    openAiApiKey,
    openAiModel,
    notifications,
  } = useSettings();
  const [isAISettingsVisible, setAISettingsVisible] = useState(false);
  const [isBasicSettingsVisible, setBasicSettingsVisible] = useState(false);
  const [isAdvancedSettingsVisible, setAdvancedSettingsVisible] = useState(false);

  const handleConnectHealthDataChange = async (value: boolean) => {
    await SettingsService.setConnectHealthData(value);
  };

  const handleReadHealthDataChange = async (value: boolean) => {
    await SettingsService.setReadHealthData(value);
  };

  const handleWriteHealthDataChange = async (value: boolean) => {
    await SettingsService.setWriteHealthData(value);
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

  const handleConnectGoogleAccount = async () => {
    // Handle Google account connection
  };

  const handleOpenAiKeyPress = async () => {
    // Handle OpenAI key press
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
              if (router.canGoBack()) {
                router.back();
              } else {
                router.push('/');
              }
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
      <ScrollView
        style={{
          flex: 1,
          marginHorizontal: theme.spacing.padding.base,
        }}
        contentContainerStyle={{ paddingBottom: theme.size['8'] }}
        showsVerticalScrollIndicator={false}
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

        {/* TODO: move this into a separate component file */}
        <View style={{ marginBottom: theme.spacing.padding.sm, width: '100%' }}>
          <GenericCard variant="default" size="sm" containerStyle={{ width: '100%' }}>
            <View
              style={{
                width: '100%',
                paddingHorizontal: theme.spacing.padding.base,
                paddingTop: theme.spacing.padding.sm,
                paddingBottom: theme.spacing.padding.sm,
              }}
            >
              <Pressable
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: theme.spacing.padding.md,
                    paddingRight: theme.size.xl + theme.spacing.padding.sm,
                    paddingHorizontal: 0,
                    paddingLeft: 0,
                    backgroundColor: pressed ? theme.colors.background.overlay : 'transparent',
                    borderRadius: theme.borderRadius.sm,
                  },
                ]}
                onPress={() => Linking.openURL('https://werules.com/musclog/terms')}
              >
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.base,
                    color: theme.colors.text.primary,
                  }}
                  numberOfLines={1}
                >
                  {t('settings.termsOfService')}
                </Text>
                <View
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: theme.size.xl,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  pointerEvents="none"
                >
                  <ExternalLink size={theme.iconSize.lg} color={theme.colors.text.secondary} />
                </View>
              </Pressable>

              <View
                style={{
                  height: theme.borderWidth.thin,
                  backgroundColor: theme.colors.border.light,
                  marginVertical: theme.spacing.padding.sm,
                }}
              />

              <Pressable
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: theme.spacing.padding.md,
                    paddingRight: theme.size.xl + theme.spacing.padding.sm,
                    paddingHorizontal: 0,
                    paddingLeft: 0,
                    backgroundColor: pressed ? theme.colors.background.overlay : 'transparent',
                    borderRadius: theme.borderRadius.sm,
                  },
                ]}
                onPress={() => Linking.openURL('https://werules.com/musclog/privacy')}
              >
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.base,
                    color: theme.colors.text.primary,
                  }}
                  numberOfLines={1}
                >
                  {t('settings.privacyPolicy')}
                </Text>
                <View
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: theme.size.xl,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  pointerEvents="none"
                >
                  <ExternalLink size={theme.iconSize.lg} color={theme.colors.text.secondary} />
                </View>
              </Pressable>

              <View
                style={{
                  height: theme.borderWidth.thin,
                  backgroundColor: theme.colors.border.light,
                  marginVertical: theme.spacing.padding.sm,
                }}
              />

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: theme.spacing.padding.md,
                  paddingHorizontal: 0,
                }}
              >
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.base,
                    color: theme.colors.text.secondary,
                  }}
                >
                  Musclog v{packageJson.version}
                  {buildNumber != null ? ` (Build ${buildNumber})` : ''}
                </Text>
              </View>
            </View>
          </GenericCard>
        </View>
        <View style={{ height: theme.size['8'] }} />
      </ScrollView>

      <AISettingsModal
        visible={isAISettingsVisible}
        onClose={() => setAISettingsVisible(false)}
        googleGeminiApiKey={googleGeminiApiKey}
        onGoogleGeminiApiKeyChange={handleGoogleGeminiApiKeyChange}
        geminiModel={googleGeminiModel}
        onGeminiModelPress={handleGoogleGeminiModelChange}
        openAiApiKey={openAiApiKey}
        onOpenAiApiKeyChange={handleOpenAiApiKeyChange}
        openAiModel={openAiModel}
        onOpenAiModelPress={handleOpenAiModelChange}
      />
      <BasicSettingsModal
        visible={isBasicSettingsVisible}
        onClose={() => setBasicSettingsVisible(false)}
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
      />
    </MasterLayout>
  );
}
