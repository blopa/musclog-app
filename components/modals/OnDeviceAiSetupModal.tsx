import { ExternalLink } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';
import { type DownloadableModel, downloadOnDeviceModel } from '@/utils/onDeviceAi';

import { FullScreenModal } from './FullScreenModal';

const AICORE_ENROLLMENT_URL = 'https://developers.google.com/ml-kit/genai/aicore-dev-preview';
const AICORE_PLAY_STORE_URL = 'market://details?id=com.google.android.aicore';
const AICORE_PLAY_STORE_WEB_URL =
  'https://play.google.com/store/apps/details?id=com.google.android.aicore';

async function openEnrollment() {
  await Linking.openURL(AICORE_ENROLLMENT_URL);
}

async function openPlayStore() {
  const canOpen = await Linking.canOpenURL(AICORE_PLAY_STORE_URL);
  await Linking.openURL(canOpen ? AICORE_PLAY_STORE_URL : AICORE_PLAY_STORE_WEB_URL);
}

type Props = {
  visible: boolean;
  onClose: () => void;
  downloadableModels: DownloadableModel[];
  onModelReady: () => void;
};

export function OnDeviceAiSetupModal({
  visible,
  onClose,
  downloadableModels,
  onModelReady,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async (modelId: string) => {
    setDownloadError(null);
    setDownloadingModelId(modelId);
    setDownloadProgress(0);
    try {
      await downloadOnDeviceModel(modelId, (p) => setDownloadProgress(p));
      setDownloadingModelId(null);
      onModelReady();
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : String(e));
      setDownloadingModelId(null);
    }
  };

  const steps = t('settings.aiSettings.onDeviceAi.builtInSteps', {
    returnObjects: true,
  }) as string[];

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('settings.aiSettings.onDeviceAi.setupTitle')}
      subtitle={t('settings.aiSettings.onDeviceAi.setupSubtitle')}
    >
      <View className="gap-6 px-4 py-6">
        {/* Built-in model — AICore enrollment */}
        <View className="gap-3">
          <Text
            className="px-1 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.accent.primary }}
          >
            {t('settings.aiSettings.onDeviceAi.optionBuiltIn')}
          </Text>
          <View
            style={{
              backgroundColor: theme.colors.background.card,
              borderRadius: theme.borderRadius.lg,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.border.light,
              padding: theme.spacing.padding.base,
              gap: theme.spacing.padding.sm,
            }}
          >
            <Text className="text-sm font-semibold text-text-primary">
              {t('settings.aiSettings.onDeviceAi.builtInNotReady')}
            </Text>
            <Text className="text-xs text-text-secondary">
              {t('settings.aiSettings.onDeviceAi.builtInNotReadySubtitle')}
            </Text>

            {steps.map((step, i) => (
              <View key={i} className="flex-row items-start gap-2">
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: theme.colors.accent.primary20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                    flexShrink: 0,
                  }}
                >
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.xs,
                      fontWeight: 'bold',
                      color: theme.colors.accent.primary,
                    }}
                  >
                    {i + 1}
                  </Text>
                </View>
                <Text className="flex-1 text-xs text-text-secondary">{step}</Text>
              </View>
            ))}

            <Text className="text-xs" style={{ color: theme.colors.text.tertiary }}>
              {t('settings.aiSettings.onDeviceAi.builtInDownloadNote')}
            </Text>

            <View className="gap-2">
              <Pressable
                onPress={openEnrollment}
                className="flex-row items-center justify-center gap-2 active:opacity-70"
                style={{
                  backgroundColor: theme.colors.accent.primary,
                  padding: theme.spacing.padding.sm,
                  borderRadius: theme.borderRadius.md,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.text.black,
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: '600',
                  }}
                >
                  {t('settings.aiSettings.onDeviceAi.openEnrollment')}
                </Text>
                <ExternalLink size={theme.iconSize.sm} color={theme.colors.text.black} />
              </Pressable>

              <Pressable
                onPress={openPlayStore}
                className="flex-row items-center justify-center gap-2 active:opacity-70"
                style={{
                  borderWidth: theme.borderWidth.thin,
                  borderColor: theme.colors.accent.primary,
                  padding: theme.spacing.padding.sm,
                  borderRadius: theme.borderRadius.md,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.accent.primary,
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: '600',
                  }}
                >
                  {t('settings.aiSettings.onDeviceAi.openAiCorePlayStore')}
                </Text>
                <ExternalLink size={theme.iconSize.sm} color={theme.colors.accent.primary} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Downloadable models — alternative */}
        {downloadableModels.length > 0 ? (
          <View className="gap-3">
            <Text
              className="px-1 text-xs font-bold uppercase tracking-wider"
              style={{ color: theme.colors.accent.primary }}
            >
              {t('settings.aiSettings.onDeviceAi.optionDownload')}
            </Text>
            <View
              style={{
                backgroundColor: theme.colors.background.card,
                borderRadius: theme.borderRadius.lg,
                borderWidth: theme.borderWidth.thin,
                borderColor: theme.colors.border.light,
                padding: theme.spacing.padding.base,
                gap: theme.spacing.padding.sm,
              }}
            >
              <Text className="text-xs text-text-secondary">
                {t('settings.aiSettings.onDeviceAi.downloadRequiredSubtitle')}
              </Text>

              {downloadableModels.map((model) => {
                const isDownloading = downloadingModelId === model.id;
                const isDownloaded = model.status === 'ready' || model.status === 'loading';
                const sizeMb = Math.round(model.sizeBytes / 1_000_000);
                const sizeLabel =
                  sizeMb >= 1000 ? `${(sizeMb / 1000).toFixed(1)} GB` : `${sizeMb} MB`;

                return (
                  <View
                    key={model.id}
                    style={{
                      gap: theme.spacing.padding.sm,
                      paddingTop: theme.spacing.padding.sm,
                      borderTopWidth: theme.borderWidth.thin,
                      borderTopColor: theme.colors.border.light,
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-text-primary">{model.name}</Text>
                        <Text className="text-xs text-text-tertiary">
                          {model.parameterCount} · {sizeLabel}
                        </Text>
                      </View>
                      {isDownloaded ? (
                        <Text
                          className="text-xs font-semibold"
                          style={{ color: theme.colors.status.success }}
                        >
                          {t('settings.aiSettings.onDeviceAi.downloaded')}
                        </Text>
                      ) : !isDownloading ? (
                        <Button
                          label={t('settings.aiSettings.onDeviceAi.download')}
                          onPress={() => handleDownload(model.id)}
                          size="sm"
                          variant="accent"
                          disabled={downloadingModelId !== null}
                        />
                      ) : null}
                    </View>

                    {isDownloading ? (
                      <View className="gap-1">
                        <View
                          style={{
                            height: 4,
                            backgroundColor: theme.colors.border.light,
                            borderRadius: 2,
                            overflow: 'hidden',
                          }}
                        >
                          <View
                            style={{
                              height: '100%',
                              width: `${Math.round(downloadProgress * 100)}%`,
                              backgroundColor: theme.colors.accent.primary,
                              borderRadius: 2,
                            }}
                          />
                        </View>
                        <Text className="text-xs text-text-tertiary">
                          {t('settings.aiSettings.onDeviceAi.downloading', {
                            percent: Math.round(downloadProgress * 100),
                          })}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}

              {downloadError ? (
                <Text className="text-xs" style={{ color: theme.colors.status.error }}>
                  {downloadError}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <Text className="px-1 text-xs" style={{ color: theme.colors.text.tertiary }}>
          {t('settings.aiSettings.onDeviceAi.privacyNote')}
        </Text>
      </View>
    </FullScreenModal>
  );
}
