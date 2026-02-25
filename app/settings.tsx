import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { LegalLinksCard } from '../components/cards/LegalLinksCard';
import { SettingsCard } from '../components/cards/SettingsCard';
import { MasterLayout } from '../components/MasterLayout';
import { AdvancedSettingsModal } from '../components/modals/AdvancedSettingsModal';
import { AISettingsModal } from '../components/modals/AISettingsModal';
import { BasicSettingsModal } from '../components/modals/BasicSettingsModal';
import { ToggleInput } from '../components/theme/ToggleInput';
import { SettingsService } from '../database/services/SettingsService';
import { useSettings } from '../hooks/useSettings';
import { theme } from '../theme';

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

        <LegalLinksCard />
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
