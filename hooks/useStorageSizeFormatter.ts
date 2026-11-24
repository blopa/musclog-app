import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { formatStorageSize, type StorageUnitKey } from '@/utils/storageUsage';

/** "219 MB", "1.4 GB": the Storage screen's size format, with each language's own unit labels. */
export function useStorageSizeFormatter(): (bytes: number) => string {
  const { t } = useTranslation();
  const { locale } = useFormatAppNumber();
  const unitLabels = useMemo<Record<StorageUnitKey, string>>(
    () => ({
      b: t('settings.advancedSettings.storage.units.b'),
      kb: t('settings.advancedSettings.storage.units.kb'),
      mb: t('settings.advancedSettings.storage.units.mb'),
      gb: t('settings.advancedSettings.storage.units.gb'),
    }),
    [t]
  );

  return useCallback(
    (bytes: number) => formatStorageSize(locale, bytes, unitLabels),
    [locale, unitLabels]
  );
}
