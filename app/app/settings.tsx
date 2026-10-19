import MaterialIcons from '@react-native-vector-icons/material-icons/static';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { type ComponentProps, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { HelpAndFeedbackCard } from '@/components/cards/HelpAndFeedbackCard';
import { LegalLinksCard } from '@/components/cards/LegalLinksCard';
import { SettingsCard } from '@/components/cards/SettingsCard';
import { WhatsNewCard } from '@/components/cards/WhatsNewCard';
import { MasterLayout } from '@/components/MasterLayout';
import { AdvancedSettingsModal } from '@/components/modals/AdvancedSettingsModal';
import { AISettingsModal } from '@/components/modals/AISettingsModal';
import { AppLockSettingsModal } from '@/components/modals/AppLockSettingsModal';
import { BasicSettingsModal } from '@/components/modals/BasicSettingsModal';
import { CycleSettingsModal } from '@/components/modals/CycleSettingsModal';
import { DataSettingsModal } from '@/components/modals/DataSettingsModal';
import { ManageBleDevicesModal } from '@/components/modals/ManageBleDevicesModal';
import { NotificationsSettingsModal } from '@/components/modals/NotificationsSettingsModal';
import { VisualSettingsModal } from '@/components/modals/VisualSettingsModal';
import { WorkoutSettingsModal } from '@/components/modals/WorkoutSettingsModal';
import { AnimatedContent } from '@/components/theme/AnimatedContent';
import { ListGroup } from '@/components/theme/ListGroup';
import { SettingsService } from '@/database/services/SettingsService';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { isAppLockSupported } from '@/utils/appLock';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

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
  const [isCycleSettingsVisible, setCycleSettingsVisible] = useState(false);
  const [isBasicSettingsVisible, setBasicSettingsVisible] = useState(false);
  const [isDataSettingsVisible, setDataSettingsVisible] = useState(false);
  const [isAppBehaviorSettingsVisible, setAppBehaviorSettingsVisible] = useState(false);
  const [isVisualSettingsVisible, setVisualSettingsVisible] = useState(false);
  const [isNotificationsSettingsVisible, setNotificationsSettingsVisible] = useState(false);
  const [isBleDevicesVisible, setBleDevicesVisible] = useState(false);
  const [isAppLockVisible, setAppLockVisible] = useState(false);
  const [isWorkoutSettingsVisible, setWorkoutSettingsVisible] = useState(false);

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

  /** One settings row: a neutral icon, the section's title and subtitle, a chevron. */
  const row = (icon: MaterialIconName, title: string, subtitle: string, onPress: () => void) => (
    <SettingsCard
      key={title}
      icon={
        <MaterialIcons name={icon} size={theme.iconSize.md} color={theme.colors.text.secondary} />
      }
      title={title}
      subtitle={subtitle}
      onPress={onPress}
    />
  );

  return (
    <MasterLayout showNavigationMenu={false}>
      <View className="border-b border-border-light bg-bg-primary">
        <View className="flex-row items-center gap-4 px-4 py-4">
          <Pressable
            className="-ml-2 rounded-full p-2"
            onPress={() => {
              router.navigate('/app');
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
          <View style={{ gap: theme.spacing.gap.xl }}>
            <ListGroup title={t('settings.groups.you')}>
              {row(
                'settings',
                t('settings.basicSettings.title'),
                t('settings.basicSettings.subtitle'),
                () => setBasicSettingsVisible(true)
              )}
            </ListGroup>

            <ListGroup title={t('settings.groups.app')}>
              {row(
                'grid-view',
                t('settings.visualSettings.title'),
                t('settings.visualSettings.subtitle'),
                () => setVisualSettingsVisible(true)
              )}
              {row(
                'notifications',
                t('settings.notificationsSettings.title'),
                t('settings.notificationsSettings.subtitle'),
                () => setNotificationsSettingsVisible(true)
              )}
              {isAppLockSupported
                ? row('lock', t('lock.settings.title'), t('lock.settings.subtitle'), () =>
                    setAppLockVisible(true)
                  )
                : null}
            </ListGroup>

            <ListGroup title={t('settings.groups.training')}>
              {row(
                'fitness-center',
                t('settings.workoutSettings.title'),
                t('settings.workoutSettings.subtitle'),
                () => setWorkoutSettingsVisible(true)
              )}
              {row(
                'bluetooth',
                t('settings.bleDevices.title'),
                t('settings.bleDevices.subtitle'),
                () => setBleDevicesVisible(true)
              )}
            </ListGroup>

            <ListGroup title={t('settings.groups.nutritionHealth')}>
              {row(
                'tune',
                t('settings.appBehaviorSettings.title'),
                t('settings.appBehaviorSettings.subtitle'),
                () => setAppBehaviorSettingsVisible(true)
              )}
              {row('calendar-month', t('cycle.settings.title'), t('cycle.settings.subtitle'), () =>
                setCycleSettingsVisible(true)
              )}
            </ListGroup>

            <ListGroup title={t('settings.groups.ai')}>
              {row(
                'smart-toy',
                t('settings.aiSettings.title'),
                t('settings.aiSettings.subtitle'),
                () => setAISettingsVisible(true)
              )}
            </ListGroup>

            <ListGroup title={t('settings.groups.data')}>
              {row(
                'sd-storage',
                t('settings.advancedSettings.title'),
                t('settings.advancedSettings.subtitle'),
                () => setDataSettingsVisible(true)
              )}
            </ListGroup>

            <ListGroup title={t('settings.groups.about')}>
              <HelpAndFeedbackCard />
              <WhatsNewCard />
            </ListGroup>

            <LegalLinksCard />
          </View>
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
      <DataSettingsModal
        visible={isDataSettingsVisible}
        onClose={() => setDataSettingsVisible(false)}
      />
      <AdvancedSettingsModal
        visible={isAppBehaviorSettingsVisible}
        onClose={() => setAppBehaviorSettingsVisible(false)}
      />
      <VisualSettingsModal
        visible={isVisualSettingsVisible}
        onClose={() => setVisualSettingsVisible(false)}
      />
      <WorkoutSettingsModal
        visible={isWorkoutSettingsVisible}
        onClose={() => setWorkoutSettingsVisible(false)}
      />
      <CycleSettingsModal
        visible={isCycleSettingsVisible}
        onClose={() => setCycleSettingsVisible(false)}
      />
      <AppLockSettingsModal visible={isAppLockVisible} onClose={() => setAppLockVisible(false)} />
      <NotificationsSettingsModal
        visible={isNotificationsSettingsVisible}
        onClose={() => setNotificationsSettingsVisible(false)}
      />
      <ManageBleDevicesModal
        visible={isBleDevicesVisible}
        onClose={() => setBleDevicesVisible(false)}
      />
    </MasterLayout>
  );
}
