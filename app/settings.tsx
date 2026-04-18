import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { LegalLinksCard } from '@/components/cards/LegalLinksCard';
import { SettingsCard } from '@/components/cards/SettingsCard';
import { MasterLayout } from '@/components/MasterLayout';
import { AdvancedSettingsModal } from '@/components/modals/AdvancedSettingsModal';
import { AISettingsModal } from '@/components/modals/AISettingsModal';
import { BasicSettingsModal } from '@/components/modals/BasicSettingsModal';
import { NotificationsSettingsModal } from '@/components/modals/NotificationsSettingsModal';
import { VisualSettingsModal } from '@/components/modals/VisualSettingsModal';
import { AnimatedContent } from '@/components/theme/AnimatedContent';
import { SettingsService } from '@/database/services/SettingsService';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';

export default function SettingsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const {
    googleGeminiApiKey,
    googleGeminiModel,
    openAiApiKey,
    openAiModel,
    localLlmApiKey,
    localLlmModel,
    localLlmBaseUrl,
  } = useSettings();
  const [isAISettingsVisible, setAISettingsVisible] = useState(false);
  const [isBasicSettingsVisible, setBasicSettingsVisible] = useState(false);
  const [isAdvancedSettingsVisible, setAdvancedSettingsVisible] = useState(false);
  const [isVisualSettingsVisible, setVisualSettingsVisible] = useState(false);
  const [isNotificationsSettingsVisible, setNotificationsSettingsVisible] = useState(false);

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

  const handleLocalLlmApiKeyChange = async (value: string) => {
    await SettingsService.setLocalLlmApiKey(value);
  };

  const handleLocalLlmModelChange = async (value: string) => {
    await SettingsService.setLocalLlmModel(value);
  };

  const handleLocalLlmBaseUrlChange = async (value: string) => {
    await SettingsService.setLocalLlmBaseUrl(value);
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <View className="border-b border-border-light bg-bg-primary">
        <View className="flex-row items-center gap-4 px-4 py-4">
          <Pressable
            className="-ml-2 rounded-full p-2"
            onPress={() => {
              router.navigate('/');
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
        <AnimatedContent>
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
                name="grid-view"
                size={theme.iconSize['2xl']}
                color={theme.colors.accent.primary}
              />
            }
            title={t('settings.visualSettings.title')}
            subtitle={t('settings.visualSettings.subtitle')}
            onPress={() => setVisualSettingsVisible(true)}
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
                name="sd-storage"
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

          <SettingsCard
            icon={
              <MaterialIcons
                name="notifications"
                size={theme.iconSize['2xl']}
                color={theme.colors.accent.primary}
              />
            }
            title={t('settings.notificationsSettings.title')}
            subtitle={t('settings.notificationsSettings.subtitle')}
            onPress={() => setNotificationsSettingsVisible(true)}
            rightIcon={
              <MaterialIcons
                name="chevron-right"
                size={theme.iconSize.xl}
                color={theme.colors.text.secondary}
              />
            }
          />

          <LegalLinksCard />
          <View style={{ height: theme.size['8'] }} />
        </AnimatedContent>
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
        localLlmApiKey={localLlmApiKey}
        onLocalLlmApiKeyChange={handleLocalLlmApiKeyChange}
        localLlmModel={localLlmModel}
        onLocalLlmModelChange={handleLocalLlmModelChange}
        localLlmBaseUrl={localLlmBaseUrl}
        onLocalLlmBaseUrlChange={handleLocalLlmBaseUrlChange}
      />
      <BasicSettingsModal
        visible={isBasicSettingsVisible}
        onClose={() => setBasicSettingsVisible(false)}
      />
      <AdvancedSettingsModal
        visible={isAdvancedSettingsVisible}
        onClose={() => setAdvancedSettingsVisible(false)}
      />
      <VisualSettingsModal
        visible={isVisualSettingsVisible}
        onClose={() => setVisualSettingsVisible(false)}
      />
      <NotificationsSettingsModal
        visible={isNotificationsSettingsVisible}
        onClose={() => setNotificationsSettingsVisible(false)}
      />
    </MasterLayout>
  );
}
