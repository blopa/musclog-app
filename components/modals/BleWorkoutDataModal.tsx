import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { Button } from '@/components/theme/Button';
import type { StoredBleWorkoutFile } from '@/utils/bleWorkoutDataStorage';
import {
  cleanupStaleBleWorkoutTrackingFiles,
  createBleWorkoutZipFile,
  deleteBleWorkoutArchiveFile,
  deleteBleWorkoutFile,
  loadAllBleWorkoutFiles,
} from '@/utils/bleWorkoutDataStorage';
import { handleError } from '@/utils/handleError';

import { ConfirmationModal } from './ConfirmationModal';
import { FullScreenModal } from './FullScreenModal';

interface BleWorkoutDataModalProps {
  visible: boolean;
  onClose: () => void;
}

function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoString));
}

export function BleWorkoutDataModal({ visible, onClose }: BleWorkoutDataModalProps) {
  const { t } = useTranslation();

  const [files, setFiles] = useState<StoredBleWorkoutFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSharingAvailable, setIsSharingAvailable] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSharingAll, setIsSharingAll] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<StoredBleWorkoutFile | null>(null);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isDeleteAllModalVisible, setIsDeleteAllModalVisible] = useState(false);
  const canShareAll = Platform.OS !== 'web' && isSharingAvailable && files.length > 0;

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await cleanupStaleBleWorkoutTrackingFiles().catch(() => {
        // Silent best-effort cleanup.
      });
      const loaded = await loadAllBleWorkoutFiles();
      setFiles(loaded);
    } catch (err) {
      handleError(err, 'BleWorkoutDataModal.refresh');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      const run = () => {
        void refresh();
      };
      run();
      void Sharing.isAvailableAsync()
        .then(setIsSharingAvailable)
        .catch(() => setIsSharingAvailable(false));
    }
  }, [visible, refresh]);

  const handleShare = useCallback(
    async (file: StoredBleWorkoutFile) => {
      if (!isSharingAvailable) {
        return;
      }

      setIsProcessing(true);
      try {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
      } catch (err) {
        handleError(err, 'BleWorkoutDataModal.handleShare');
      } finally {
        setIsProcessing(false);
      }
    },
    [isSharingAvailable]
  );

  const handleRequestDelete = useCallback((file: StoredBleWorkoutFile) => {
    setFileToDelete(file);
    setIsDeleteModalVisible(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!fileToDelete) {
      return;
    }

    setIsProcessing(true);
    try {
      await deleteBleWorkoutFile(fileToDelete.uri);
      setIsDeleteModalVisible(false);
      setFileToDelete(null);
      await refresh();
    } catch (err) {
      handleError(err, 'BleWorkoutDataModal.handleConfirmDelete', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setIsProcessing(false);
    }
  }, [fileToDelete, refresh, t]);

  const handleRequestDeleteAll = useCallback(() => {
    if (files.length === 0) {
      return;
    }

    setIsDeleteAllModalVisible(true);
  }, [files.length]);

  const handleConfirmDeleteAll = useCallback(async () => {
    if (files.length === 0) {
      setIsDeleteAllModalVisible(false);
      return;
    }

    setIsProcessing(true);
    try {
      await Promise.all(files.map((file) => deleteBleWorkoutFile(file.uri)));
      setIsDeleteAllModalVisible(false);
      await refresh();
    } catch (err) {
      handleError(err, 'BleWorkoutDataModal.handleConfirmDeleteAll', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setIsProcessing(false);
    }
  }, [files, refresh, t]);

  const handleShareAll = useCallback(async () => {
    if (!canShareAll || isSharingAll) {
      return;
    }

    setIsSharingAll(true);
    let zipUri: string | null = null;
    try {
      zipUri = await createBleWorkoutZipFile(files.map((file) => file.uri));
      await Sharing.shareAsync(zipUri, { mimeType: 'application/zip' });
    } catch (err) {
      handleError(err, 'BleWorkoutDataModal.handleShareAll', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      if (zipUri) {
        await deleteBleWorkoutArchiveFile(zipUri).catch(() => {
          // Best-effort cleanup only.
        });
      }
      setIsSharingAll(false);
    }
  }, [canShareAll, files, isSharingAll, t]);

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('bleWorkoutData.modalTitle')}
      headerRight={
        <View className="flex-row flex-wrap items-center justify-end gap-2">
          {canShareAll ? (
            <Button
              label={t('bleWorkoutData.shareAll')}
              size="xs"
              variant="secondary"
              loading={isSharingAll}
              disabled={isProcessing || isSharingAll}
              onPress={() => void handleShareAll()}
            />
          ) : null}
          <Button
            label={t('bleWorkoutData.deleteAll')}
            size="xs"
            variant="discard"
            disabled={isProcessing || isSharingAll || files.length === 0}
            onPress={handleRequestDeleteAll}
          />
          <Button
            label={t('bleWorkoutData.refresh')}
            size="xs"
            variant="secondary"
            loading={isLoading}
            disabled={isProcessing || isSharingAll}
            onPress={() => void refresh()}
          />
        </View>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-3 p-4">
          {files.length === 0 && !isLoading ? (
            <View className="items-center rounded-xl border border-border-light bg-bg-primary py-12">
              <Text className="text-sm font-medium text-text-secondary">
                {t('bleWorkoutData.noFiles')}
              </Text>
              <Text className="mt-1 text-xs text-text-tertiary">
                {t('bleWorkoutData.noFilesHint')}
              </Text>
            </View>
          ) : (
            files.map((file) => (
              <GenericCard key={file.uri} variant="default">
                <View className="p-4">
                  <View className="mb-3">
                    <Text className="font-semibold text-text-primary" numberOfLines={1}>
                      {file.exerciseName}
                    </Text>
                    <Text className="text-xs text-text-tertiary">
                      {t('bleWorkoutData.setLabel', { number: file.setNumber })}
                      {' · '}
                      {formatDateTime(file.stoppedAt ?? file.startedAt)}
                      {' · '}
                      {t('bleWorkoutData.samples', { count: file.sampleCount })}
                    </Text>
                  </View>
                  <View className="flex-row gap-2">
                    {isSharingAvailable ? (
                      <Button
                        label={t('bleWorkoutData.share')}
                        size="xs"
                        variant="secondary"
                        disabled={isProcessing || isSharingAll}
                        onPress={() => void handleShare(file)}
                      />
                    ) : null}
                    <Button
                      label={t('bleWorkoutData.delete')}
                      size="xs"
                      variant="discard"
                      disabled={isProcessing || isSharingAll}
                      onPress={() => handleRequestDelete(file)}
                    />
                  </View>
                </View>
              </GenericCard>
            ))
          )}
        </View>
      </ScrollView>

      <ConfirmationModal
        visible={isDeleteModalVisible}
        onClose={() => {
          setIsDeleteModalVisible(false);
          setFileToDelete(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
        title={t('bleWorkoutData.deleteConfirmTitle')}
        message={t('bleWorkoutData.deleteConfirmMessage', {
          name: fileToDelete
            ? `${fileToDelete.exerciseName} – ${t('bleWorkoutData.setLabel', { number: fileToDelete.setNumber })}`
            : '',
        })}
        confirmLabel={t('bleWorkoutData.delete')}
        isLoading={isProcessing}
      />

      <ConfirmationModal
        visible={isDeleteAllModalVisible}
        onClose={() => setIsDeleteAllModalVisible(false)}
        onConfirm={() => void handleConfirmDeleteAll()}
        title={t('bleWorkoutData.deleteAllConfirmTitle')}
        message={t('bleWorkoutData.deleteAllConfirmMessage', { count: files.length })}
        confirmLabel={t('bleWorkoutData.deleteAll')}
        isLoading={isProcessing}
      />
    </FullScreenModal>
  );
}
