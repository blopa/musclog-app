import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';
import {
  activateOnDeviceModel,
  cancelOnDeviceModelDownload,
  deleteDownloadedOnDeviceModel,
  type DownloadableModel,
  downloadOnDeviceModelFiles,
} from '@/utils/onDeviceAi';

import { FullScreenModal } from './FullScreenModal';

type InstallPhase = 'idle' | 'downloading_files' | 'activating';

type Props = {
  visible: boolean;
  onClose: () => void;
  downloadableModels: DownloadableModel[];
  onModelReady: () => void;
  onModelsUpdated?: () => void | Promise<void>;
  onDownloadedModelDeleted?: () => void;
};

export function OnDeviceAiSetupModal({
  visible,
  onClose,
  downloadableModels,
  onModelReady,
  onModelsUpdated,
  onDownloadedModelDeleted,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [installPhase, setInstallPhase] = useState<InstallPhase>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setDownloadingModelId(null);
      setInstallPhase('idle');
      setDownloadProgress(0);
      setDownloadError(null);
    }
  }, [visible]);

  const notifyModelsUpdated = async () => {
    await onModelsUpdated?.();
  };

  const handleDownload = async (modelId: string) => {
    setDownloadError(null);
    setDownloadingModelId(modelId);
    setInstallPhase('downloading_files');
    setDownloadProgress(0);
    try {
      await downloadOnDeviceModelFiles(modelId, (p) => setDownloadProgress(p));
      setDownloadProgress(1);
      await notifyModelsUpdated();
      setInstallPhase('activating');
      await activateOnDeviceModel(modelId);
      setDownloadingModelId(null);
      setInstallPhase('idle');
      await notifyModelsUpdated();
      onModelReady();
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : String(e));
      setDownloadingModelId(null);
      setInstallPhase('idle');
      await notifyModelsUpdated();
    }
  };

  const handleCancelDownload = async (modelId: string) => {
    if (downloadingModelId === modelId) {
      setDownloadingModelId(null);
      setInstallPhase('idle');
      setDownloadProgress(0);
    }
    await cancelOnDeviceModelDownload(modelId);
    await notifyModelsUpdated();
  };

  const confirmDeleteModel = (model: DownloadableModel) => {
    Alert.alert(
      t('settings.aiSettings.onDeviceAi.deleteModelTitle', { name: model.name }),
      t('settings.aiSettings.onDeviceAi.deleteModelMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.aiSettings.onDeviceAi.deleteModelConfirm'),
          style: 'destructive',
          onPress: () => void handleDeleteModel(model.id),
        },
      ]
    );
  };

  const handleDeleteModel = async (modelId: string) => {
    setDownloadError(null);
    setDeletingModelId(modelId);
    try {
      await deleteDownloadedOnDeviceModel(modelId);
      await notifyModelsUpdated();
      onDownloadedModelDeleted?.();
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingModelId(null);
    }
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('settings.aiSettings.onDeviceAi.setupTitle')}
      subtitle={t('settings.aiSettings.onDeviceAi.setupSubtitle')}
    >
      <View className="gap-6 px-4 py-6">
        <Text className="px-1 text-xs text-text-secondary">
          {t('settings.aiSettings.onDeviceAi.setupIntro')}
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
          {downloadableModels.length === 0 ? (
            <Text className="text-sm text-text-secondary">
              {t('settings.aiSettings.onDeviceAi.emptyModels')}
            </Text>
          ) : (
            downloadableModels.map((model, index) => {
              const isRowDownloadInProgress =
                downloadingModelId === model.id || model.status === 'downloading';
              const isReady = model.status === 'ready';
              const isLoading = model.status === 'loading';
              const isDeleting = deletingModelId === model.id;
              const isOurRow = downloadingModelId === model.id;
              const showCancelDownload =
                isRowDownloadInProgress &&
                !(
                  isOurRow &&
                  (installPhase === 'activating' ||
                    (installPhase === 'downloading_files' && downloadProgress >= 0.999))
                );
              const sizeMb = Math.round(model.sizeBytes / 1_000_000);
              const sizeLabel =
                sizeMb >= 1000 ? `${(sizeMb / 1000).toFixed(1)} GB` : `${sizeMb} MB`;

              return (
                <View
                  key={model.id}
                  style={{
                    gap: theme.spacing.padding.sm,
                    paddingTop: index > 0 ? theme.spacing.padding.sm : 0,
                    borderTopWidth: index > 0 ? theme.borderWidth.thin : 0,
                    borderTopColor: index > 0 ? theme.colors.border.light : 'transparent',
                  }}
                >
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-medium text-text-primary">{model.name}</Text>
                      <Text className="text-xs text-text-tertiary">
                        {model.parameterCount} · {sizeLabel}
                      </Text>
                    </View>
                    {isReady ? (
                      <Text
                        className="shrink-0 text-xs font-semibold"
                        style={{ color: theme.colors.status.success }}
                      >
                        {t('settings.aiSettings.onDeviceAi.downloaded')}
                      </Text>
                    ) : isLoading ? (
                      <Text
                        className="shrink-0 text-xs font-semibold"
                        style={{ color: theme.colors.text.tertiary }}
                      >
                        {t('settings.aiSettings.onDeviceAi.loadingModel')}
                      </Text>
                    ) : !isRowDownloadInProgress ? (
                      <Button
                        label={t('settings.aiSettings.onDeviceAi.download')}
                        onPress={() => void handleDownload(model.id)}
                        size="sm"
                        variant="accent"
                        disabled={downloadingModelId !== null}
                        width="auto"
                      />
                    ) : null}
                  </View>

                  {isReady || isLoading ? (
                    <View className="flex-row justify-end">
                      <Button
                        label={t('settings.aiSettings.onDeviceAi.deleteModel')}
                        onPress={() => confirmDeleteModel(model)}
                        size="sm"
                        variant="discard"
                        disabled={isDeleting || downloadingModelId !== null}
                        loading={isDeleting}
                        width="auto"
                      />
                    </View>
                  ) : null}

                  {isRowDownloadInProgress ? (
                    <View className="gap-2">
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
                            width: `${isOurRow ? Math.round(downloadProgress * 100) : 12}%`,
                            backgroundColor: theme.colors.accent.primary,
                            borderRadius: 2,
                          }}
                        />
                      </View>
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className="flex-1 text-xs text-text-tertiary">
                          {isOurRow && installPhase === 'activating'
                            ? t('settings.aiSettings.onDeviceAi.preparingModel')
                            : isOurRow &&
                                installPhase === 'downloading_files' &&
                                downloadProgress >= 0.999
                              ? t('settings.aiSettings.onDeviceAi.preparingModel')
                              : isOurRow
                                ? t('settings.aiSettings.onDeviceAi.downloading', {
                                    percent: Math.round(downloadProgress * 100),
                                  })
                                : t('settings.aiSettings.onDeviceAi.downloadingActive')}
                        </Text>
                        {showCancelDownload ? (
                          <Button
                            label={t('settings.aiSettings.onDeviceAi.cancelDownload')}
                            onPress={() => void handleCancelDownload(model.id)}
                            size="sm"
                            variant="outline"
                            width="auto"
                          />
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}

          {downloadError ? (
            <Text className="text-xs" style={{ color: theme.colors.status.error }}>
              {downloadError}
            </Text>
          ) : null}
        </View>

        <Text className="px-1 text-xs" style={{ color: theme.colors.text.tertiary }}>
          {t('settings.aiSettings.onDeviceAi.privacyNote')}
        </Text>
      </View>
    </FullScreenModal>
  );
}
