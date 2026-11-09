import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { ListGroup } from '@/components/theme/ListGroup';
import { SkeletonLoader } from '@/components/theme/SkeletonLoader';
import { useSnackbar } from '@/context/SnackbarContext';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSubModalState } from '@/hooks/useSubModalVisibility';
import { useTheme } from '@/hooks/useTheme';
import { clearStorageCategory, measureStorage, type StorageReport } from '@/services/storageUsage';
import { handleError } from '@/utils/handleError';
import {
  type ClearableStorageCategoryId,
  formatStorageSize,
  isClearableStorageCategory,
  type StorageCategoryId,
  type StorageUnitKey,
} from '@/utils/storageUsage';

import { ConfirmationModal } from './ConfirmationModal';
import { FullScreenModal } from './FullScreenModal';

type StorageUsageModalProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Translation keys are whole-key tables (never built from the id) so `check-translations` sees
 * them.
 */
const CATEGORY_NAME_KEYS: Record<StorageCategoryId, string> = {
  database: 'settings.advancedSettings.storage.categories.database.name',
  photos: 'settings.advancedSettings.storage.categories.photos.name',
  sensorRecordings: 'settings.advancedSettings.storage.categories.sensorRecordings.name',
  recoveryPoints: 'settings.advancedSettings.storage.categories.recoveryPoints.name',
  exerciseImages: 'settings.advancedSettings.storage.categories.exerciseImages.name',
  temporary: 'settings.advancedSettings.storage.categories.temporary.name',
};

const CATEGORY_DESCRIPTION_KEYS: Record<StorageCategoryId, string> = {
  database: 'settings.advancedSettings.storage.categories.database.description',
  photos: 'settings.advancedSettings.storage.categories.photos.description',
  sensorRecordings: 'settings.advancedSettings.storage.categories.sensorRecordings.description',
  recoveryPoints: 'settings.advancedSettings.storage.categories.recoveryPoints.description',
  exerciseImages: 'settings.advancedSettings.storage.categories.exerciseImages.description',
  temporary: 'settings.advancedSettings.storage.categories.temporary.description',
};

const CLEAR_MESSAGE_KEYS: Record<ClearableStorageCategoryId, string> = {
  exerciseImages: 'settings.advancedSettings.storage.clearMessage.exerciseImages',
  temporary: 'settings.advancedSettings.storage.clearMessage.temporary',
};

export function StorageUsageModal({ visible, onClose }: StorageUsageModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const { locale } = useFormatAppNumber();

  const [report, setReport] = useState<StorageReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [clearTarget, setClearTarget] = useSubModalState<ClearableStorageCategoryId | null>(
    visible,
    null
  );

  const unitLabels = useMemo<Record<StorageUnitKey, string>>(
    () => ({
      b: t('settings.advancedSettings.storage.units.b'),
      kb: t('settings.advancedSettings.storage.units.kb'),
      mb: t('settings.advancedSettings.storage.units.mb'),
      gb: t('settings.advancedSettings.storage.units.gb'),
    }),
    [t]
  );
  const formatSize = useCallback(
    (bytes: number) => formatStorageSize(locale, bytes, unitLabels),
    [locale, unitLabels]
  );

  // Bumping this re-measures; the previous numbers stay on screen until the new ones arrive.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let cancelled = false;
    measureStorage()
      .then((next) => {
        if (!cancelled) {
          setReport(next);
          setFailed(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setFailed(true);
          handleError(error, 'StorageUsageModal.measure', { showSnackbar: false });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, reloadKey]);

  const handleClear = useCallback(async () => {
    if (!clearTarget) {
      return;
    }

    try {
      const freed = await clearStorageCategory(clearTarget);
      showSnackbar(
        'success',
        freed > 0
          ? t('settings.advancedSettings.storage.freed', { size: formatSize(freed) })
          : t('settings.advancedSettings.storage.nothingToClear')
      );
    } catch (error) {
      handleError(error, 'StorageUsageModal.handleClear', {
        snackbarMessage: t('settings.advancedSettings.storage.clearFailed'),
      });
    } finally {
      reload();
    }
  }, [clearTarget, formatSize, reload, showSnackbar, t]);

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('settings.advancedSettings.storage.title')}
    >
      <ScrollView className="mt-6 px-4">
        {isLoading ? (
          <View className="gap-4">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonLoader key={i} height={72} width="100%" />
            ))}
          </View>
        ) : failed || !report ? (
          <View className="gap-4">
            <Text className="text-base text-text-secondary">
              {t('settings.advancedSettings.storage.unavailable')}
            </Text>
            <Button
              label={t('settings.advancedSettings.storage.retry')}
              variant="outline"
              onPress={reload}
            />
          </View>
        ) : (
          <View className="gap-6 pb-8">
            <View>
              <Text className="text-sm font-semibold text-text-secondary">
                {t('settings.advancedSettings.storage.total')}
              </Text>
              <Text
                className="text-3xl font-bold text-text-primary"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatSize(report.totalBytes)}
              </Text>
            </View>

            <ListGroup>
              {report.categories.map((category) => (
                <View
                  key={category.id}
                  className="flex-row flex-wrap items-center gap-3"
                  style={{
                    paddingHorizontal: theme.spacing.padding.base,
                    paddingVertical: theme.spacing.padding.base,
                  }}
                >
                  <View className="min-w-0 grow basis-[160px]">
                    <Text className="text-base font-semibold text-text-primary">
                      {t(CATEGORY_NAME_KEYS[category.id])}
                    </Text>
                    <Text className="text-sm text-text-secondary">
                      {t(CATEGORY_DESCRIPTION_KEYS[category.id])}
                    </Text>
                  </View>
                  <View className="shrink-0 items-end gap-2">
                    <Text
                      className="text-base font-semibold text-text-primary"
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {formatSize(category.bytes)}
                    </Text>
                    {isClearableStorageCategory(category.id) ? (
                      <Button
                        label={t('settings.advancedSettings.storage.clear')}
                        variant="outline"
                        size="sm"
                        disabled={category.bytes === 0}
                        onPress={() => setClearTarget(category.id as ClearableStorageCategoryId)}
                      />
                    ) : null}
                  </View>
                </View>
              ))}
            </ListGroup>
          </View>
        )}
      </ScrollView>

      <ConfirmationModal
        visible={clearTarget !== null}
        onClose={() => setClearTarget(null)}
        onConfirm={handleClear}
        title={t('settings.advancedSettings.storage.clearTitle', {
          name: clearTarget ? t(CATEGORY_NAME_KEYS[clearTarget]) : '',
        })}
        message={clearTarget ? t(CLEAR_MESSAGE_KEYS[clearTarget]) : ''}
        confirmLabel={t('settings.advancedSettings.storage.clear')}
      />
    </FullScreenModal>
  );
}
