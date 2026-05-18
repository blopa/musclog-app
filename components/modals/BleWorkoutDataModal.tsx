import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { Button } from '@/components/theme/Button';
import type { StoredBleWorkoutFile } from '@/utils/bleWorkoutDataStorage';
import { deleteBleWorkoutFile, loadAllBleWorkoutFiles } from '@/utils/bleWorkoutDataStorage';
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
  const [fileToDelete, setFileToDelete] = useState<StoredBleWorkoutFile | null>(null);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
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
      void refresh();
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

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('bleWorkoutData.modalTitle')}
      headerRight={
        <Button
          label={t('bleWorkoutData.refresh')}
          size="xs"
          variant="secondary"
          loading={isLoading}
          onPress={() => void refresh()}
        />
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
                        disabled={isProcessing}
                        onPress={() => void handleShare(file)}
                      />
                    ) : null}
                    <Button
                      label={t('bleWorkoutData.delete')}
                      size="xs"
                      variant="discard"
                      disabled={isProcessing}
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
    </FullScreenModal>
  );
}
