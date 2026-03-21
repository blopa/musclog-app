import { LinearGradient } from 'expo-linear-gradient';
import { Bot, KeyRound, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { Button } from '../theme/Button';
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
      <View className="flex-1 justify-center px-5 pb-4">
        <View className="mb-8 items-center">
          <LinearGradient
            colors={[theme.colors.status.purple40, theme.colors.accent.secondary10]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.border.light,
            }}
          >
            <Bot
              size={theme.iconSize['2xl']}
              color={theme.colors.text.primary}
              strokeWidth={1.75}
            />
          </LinearGradient>
        </View>

        <View
          style={{
            backgroundColor: theme.colors.background.card,
            borderRadius: theme.borderRadius['2xl'],
            borderWidth: theme.borderWidth.thin,
            borderColor: theme.colors.border.light,
            padding: theme.spacing.padding.lg,
            gap: theme.spacing.gap.md,
          }}
        >
          <View className="flex-row gap-3">
            <View
              className="items-center justify-center rounded-xl"
              style={{
                width: 44,
                height: 44,
                backgroundColor: theme.colors.accent.primary10,
              }}
            >
              <KeyRound size={theme.iconSize.md} color={theme.colors.accent.primary} />
            </View>
            <View className="flex-1 justify-center">
              <Text className="text-base font-semibold leading-snug text-text-primary">
                {t('ai.notConfiguredModal.tipApiKey')}
              </Text>
            </View>
          </View>

          <View
            style={{
              height: theme.borderWidth.thin,
              backgroundColor: theme.colors.border.light,
            }}
          />

          <View className="flex-row gap-3">
            <View
              className="items-center justify-center rounded-xl"
              style={{
                width: 44,
                height: 44,
                backgroundColor: theme.colors.status.purple13,
              }}
            >
              <Sparkles size={theme.iconSize.md} color={theme.colors.status.purple} />
            </View>
            <View className="flex-1 justify-center">
              <Text className="text-base font-semibold leading-snug text-text-primary">
                {t('ai.notConfiguredModal.tipFeatures')}
              </Text>
              <Text className="mt-1 text-sm leading-relaxed text-text-secondary">
                {t('ai.settings.notConfigured')}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </FullScreenModal>
  );
}
