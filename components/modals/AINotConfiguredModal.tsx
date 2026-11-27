import { Bot, Download, KeyRound, Settings2, Sparkles, Wand2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';

import { AiOutputNotice } from '@/components/ai/AiOutputNotice';
import { PremiumModal } from '@/components/modals/PremiumModal';
import { Button } from '@/components/theme/Button';
import { useOnDeviceStatus } from '@/hooks/useOnDeviceStatus';
import { usePremium } from '@/hooks/usePremium';
import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';
import { useTheme } from '@/hooks/useTheme';
import { localModelStore } from '@/services/localModels/modelStore';
import { disableOnDeviceAi } from '@/services/onDeviceAiSetup';
import { DEFAULT_LOCAL_MODEL_SELECTION } from '@/utils/localModels/install';
import type { OnDeviceStatusState } from '@/utils/onDeviceStatus';

import { FullScreenModal } from './FullScreenModal';

/** One whole key per state the on-device AI can be stuck in. */
const NOT_READY_MESSAGE_KEYS: Record<Exclude<OnDeviceStatusState, 'ready'>, string> = {
  needsDownload: 'onDeviceAi.notReady.message.needsDownload',
  downloading: 'onDeviceAi.notReady.message.downloading',
  downloadFailed: 'onDeviceAi.notReady.message.downloadFailed',
  appleOff: 'onDeviceAi.notReady.message.appleOff',
  appleNotReady: 'onDeviceAi.notReady.message.appleNotReady',
  appleNotEligible: 'onDeviceAi.notReady.message.appleNotEligible',
  unsupported: 'onDeviceAi.notReady.message.unsupported',
};

type AINotConfiguredModalProps = {
  visible: boolean;
  onClose: () => void;
  /** When set, shows a primary action to open AI settings (parent usually closes the modal in this handler). */
  onOpenAISettings?: () => void;
  /**
   * `localNotReady`: AI on this phone is the chosen provider but cannot answer yet (model not
   * downloaded, Apple Intelligence off). It says why and offers the fix.
   */
  variant?: 'notConfigured' | 'localNotReady';
};

export function AINotConfiguredModal({
  visible,
  onClose,
  onOpenAISettings,
  variant = 'notConfigured',
}: AINotConfiguredModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const premium = usePremium();
  const status = useOnDeviceStatus();
  const notReady = variant === 'localNotReady';
  const [premiumVisible, setPremiumVisible] = useSubModalVisibility(visible);

  // Premium is offered only in builds where it is switched on; otherwise the footer is unchanged.
  const premiumButton = premium.enabled ? (
    <Button
      label={t('ai.notConfiguredModal.premium')}
      variant="accent"
      width="full"
      onPress={() => setPremiumVisible(true)}
      icon={Sparkles}
    />
  ) : null;

  const settingsFooter = onOpenAISettings ? (
    <View className="gap-3">
      <Button
        label={t('ai.notConfiguredModal.openSettings')}
        variant="gradientCta"
        width="full"
        onPress={() => {
          onOpenAISettings();
          onClose();
        }}
        icon={KeyRound}
      />
      <Button
        label={t('ai.notConfiguredModal.notNow')}
        variant="outline"
        width="full"
        onPress={onClose}
      />
    </View>
  ) : (
    <Button label={t('common.close')} variant="accent" width="full" onPress={onClose} />
  );

  const notReadyFooter = (
    <View className="gap-3">
      {status.state === 'needsDownload' || status.state === 'downloadFailed' ? (
        <Button
          label={t('onDeviceAi.notReady.download')}
          variant="accent"
          width="full"
          icon={Download}
          onPress={() => {
            void localModelStore.start(DEFAULT_LOCAL_MODEL_SELECTION);
            onClose();
          }}
        />
      ) : null}
      {status.state === 'appleOff' ? (
        <Button
          label={t('onDeviceAi.notReady.openIosSettings')}
          variant="accent"
          width="full"
          icon={Settings2}
          onPress={() => void Linking.openSettings()}
        />
      ) : null}
      {onOpenAISettings ? (
        <Button
          label={t('onDeviceAi.notReady.openAiSettings')}
          variant="outline"
          width="full"
          icon={KeyRound}
          onPress={() => {
            onOpenAISettings();
            onClose();
          }}
        />
      ) : null}
      <Button
        label={t('onDeviceAi.notReady.chooseAnother')}
        variant="outline"
        width="full"
        onPress={async () => {
          await disableOnDeviceAi();
          onOpenAISettings?.();
          onClose();
        }}
      />
    </View>
  );

  const configuredFallback = premium.enabled ? (
    <View className="gap-3">
      {premiumButton}
      {settingsFooter}
    </View>
  ) : (
    settingsFooter
  );

  // With Premium off this is exactly the footer that shipped before.
  const footer = notReady ? notReadyFooter : configuredFallback;

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t(notReady ? 'onDeviceAi.notReady.title' : 'ai.notConfiguredModal.title')}
      subtitle={
        notReady && status.state !== 'ready'
          ? t(NOT_READY_MESSAGE_KEYS[status.state])
          : t('ai.notConfiguredModal.subtitle')
      }
      footer={footer}
    >
      <View className="justify-start px-5 pb-4 pt-3">
        <View pointerEvents="none" style={{ height: theme.spacing.padding['3xl'] }} />
        <View className="mb-6 items-center">
          <View className="relative">
            <View
              style={{
                width: 110,
                height: 110,
                borderRadius: 55,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                backgroundColor: theme.colors.accent.primary10,
                borderWidth: theme.borderWidth.thin,
                borderColor: theme.colors.border.light,
              }}
            >
              <Bot
                size={theme.iconSize['3xl']}
                color={theme.colors.accent.primary}
                strokeWidth={1.5}
              />
            </View>
            <View
              className="absolute -bottom-1 -right-1 h-10 w-10 items-center justify-center rounded-full border-2 bg-bg-card shadow-sm"
              style={{ borderColor: theme.colors.background.primary }}
            >
              <Wand2 size={20} color={theme.colors.status.purple} />
            </View>
          </View>
        </View>

        <View
          style={{
            backgroundColor: theme.colors.background.card,
            borderRadius: theme.borderRadius['3xl'],
            borderWidth: theme.borderWidth.thin,
            borderColor: theme.colors.border.light,
            padding: theme.spacing.padding.xl,
            gap: theme.spacing.gap.lg,
          }}
        >
          <View className="flex-row gap-4">
            <View
              className="items-center justify-center rounded-card"
              style={{
                width: 48,
                height: 48,
                backgroundColor: theme.colors.accent.primary10,
              }}
            >
              <KeyRound size={theme.iconSize.md} color={theme.colors.accent.primary} />
            </View>
            <View className="flex-1 justify-center">
              <Text className="text-lg font-semibold leading-snug text-text-primary">
                {t('ai.notConfiguredModal.tipApiKey')}
              </Text>
              <Text className="mt-0.5 text-sm text-text-tertiary">
                {t('ai.providers.openAIGemini')}
              </Text>
            </View>
          </View>

          <View
            style={{
              height: theme.borderWidth.thin,
              backgroundColor: theme.colors.border.light,
              marginHorizontal: -theme.spacing.padding.xl,
            }}
          />

          <View className="flex-row gap-4">
            <View
              className="items-center justify-center rounded-card"
              style={{
                width: 48,
                height: 48,
                backgroundColor: theme.colors.status.purple13,
              }}
            >
              <Sparkles size={theme.iconSize.md} color={theme.colors.status.purple} />
            </View>
            <View className="flex-1 justify-center">
              <Text className="text-lg font-semibold leading-snug text-text-primary">
                {t('ai.notConfiguredModal.tipFeatures')}
              </Text>
              <Text className="mt-1 text-sm leading-relaxed text-text-secondary">
                {t('ai.settings.notConfigured')}
              </Text>
            </View>
          </View>
        </View>

        <View className="mt-4">
          <AiOutputNotice kind="settings" align="center" />
        </View>
      </View>
      <PremiumModal visible={premiumVisible} onClose={() => setPremiumVisible(false)} />
    </FullScreenModal>
  );
}
