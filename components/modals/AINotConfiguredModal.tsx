import { LinearGradient } from 'expo-linear-gradient';
import { Bot, KeyRound, Sparkles, Wand2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';

import { FullScreenModal } from './FullScreenModal';

type AINotConfiguredModalProps = {
  visible: boolean;
  onClose: () => void;
  /** When set, shows a primary action to open AI settings (parent usually closes the modal in this handler). */
  onOpenAISettings?: () => void;
};

export function AINotConfiguredModal({
  visible,
  onClose,
  onOpenAISettings,
}: AINotConfiguredModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const footer = onOpenAISettings ? (
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

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('ai.notConfiguredModal.title')}
      subtitle={t('ai.notConfiguredModal.subtitle')}
      withGradient
      scrollable={false}
      footer={footer}
    >
      <View className="flex-1 justify-start px-5 pt-3 pb-4">
        <View pointerEvents="none" style={{ height: theme.spacing.padding['3xl'] }} />
        <View className="mb-6 items-center">
          <View className="relative">
            <LinearGradient
              colors={[theme.colors.status.purple40, theme.colors.accent.secondary10]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 110,
                height: 110,
                borderRadius: 55,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderWidth: theme.borderWidth.thin,
                borderColor: theme.colors.border.light,
              }}
            >
              <Bot
                size={theme.iconSize['3xl']}
                color={theme.colors.text.primary}
                strokeWidth={1.5}
              />
            </LinearGradient>
            <View
              className="bg-bg-card absolute -right-1 -bottom-1 h-10 w-10 items-center justify-center rounded-full border-2 shadow-sm"
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
            shadowColor: theme.colors.status.purple,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.1,
            shadowRadius: 20,
            elevation: 5,
          }}
        >
          <View className="flex-row gap-4">
            <View
              className="items-center justify-center rounded-2xl"
              style={{
                width: 48,
                height: 48,
                backgroundColor: theme.colors.accent.primary10,
              }}
            >
              <KeyRound size={theme.iconSize.md} color={theme.colors.accent.primary} />
            </View>
            <View className="flex-1 justify-center">
              <Text className="text-text-primary text-lg leading-snug font-bold">
                {t('ai.notConfiguredModal.tipApiKey')}
              </Text>
              <Text className="text-text-tertiary mt-0.5 text-sm">
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
              className="items-center justify-center rounded-2xl"
              style={{
                width: 48,
                height: 48,
                backgroundColor: theme.colors.status.purple13,
              }}
            >
              <Sparkles size={theme.iconSize.md} color={theme.colors.status.purple} />
            </View>
            <View className="flex-1 justify-center">
              <Text className="text-text-primary text-lg leading-snug font-bold">
                {t('ai.notConfiguredModal.tipFeatures')}
              </Text>
              <Text className="text-text-secondary mt-1 text-sm leading-relaxed">
                {t('ai.settings.notConfigured')}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </FullScreenModal>
  );
}
