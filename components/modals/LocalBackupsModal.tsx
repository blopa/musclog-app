import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { BottomPopUpMenu, type BottomPopUpMenuItem } from '@/components/BottomPopUpMenu';
import { GenericCard } from '@/components/cards/GenericCard';
import { MenuButton } from '@/components/theme/MenuButton';
import { SkeletonLoader } from '@/components/theme/SkeletonLoader';
import { useSnackbar } from '@/context/SnackbarContext';
import { restoreDatabase } from '@/database/importDb';
import { type BackupFileMeta, deleteBackup, getStoredBackups } from '@/database/preMigrationBackup';
import { SettingsService } from '@/database/services/SettingsService';
import { useTheme } from '@/hooks/useTheme';
import { reloadApp } from '@/utils/app';
import { downloadFile, readFileAsStringAsync } from '@/utils/file';
import { handleError } from '@/utils/handleError';

import { ConfirmationModal } from './ConfirmationModal';
import { FullScreenModal } from './FullScreenModal';

type LocalBackupsModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function LocalBackupsModal({ visible, onClose }: LocalBackupsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();

  const [backups, setBackups] = useState<BackupFileMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBackup, setSelectedBackup] = useState<BackupFileMeta | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [requireExportEncryption, setRequireExportEncryption] = useState(true);
  const [databaseFailedToInitiate, setDatabaseFailedToInitiate] = useState(false);

  const fetchBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      // Always try to get backups first
      const data = await getStoredBackups();
      setBackups(data);

      // Try to get settings separately - if this fails, we still have the backups
      try {
        const requireExportSetting = await SettingsService.getRequireExportEncryption();
        setRequireExportEncryption(requireExportSetting);
        setDatabaseFailedToInitiate(false);
      } catch (settingsError) {
        console.error('Failed to get settings, treating as disabled:', settingsError);
        // If we can't get settings, assume database failed and treat as if setting was disabled
        setDatabaseFailedToInitiate(true);
        setRequireExportEncryption(false); // Consider as disabled to allow export
      }
    } catch (error) {
      handleError(error, 'LocalBackupsModal.fetchBackups');
      setDatabaseFailedToInitiate(true);
      setRequireExportEncryption(false); // Consider as disabled to allow export
      setBackups([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchBackups();
    }
  }, [visible, fetchBackups]);

  const handleItemPress = (backup: BackupFileMeta) => {
    setSelectedBackup(backup);
    setShowMenu(true);
  };

  const handleExport = async () => {
    if (!selectedBackup) {
      return;
    }
    setShowMenu(false);
    try {
      const fileName = selectedBackup.uri.split('/').pop();
      await downloadFile(selectedBackup.uri, fileName);
    } catch (error) {
      console.error('Export failed:', error);
      showSnackbar('error', t('settings.advancedSettings.exportFailedMessage'));
    }
  };

  const handleRestore = () => {
    setShowMenu(false);
    setRestoreModalVisible(true);
  };

  const handleConfirmRestore = async () => {
    if (!selectedBackup) {
      return;
    }
    setIsProcessing(true);
    try {
      const content = await readFileAsStringAsync(selectedBackup.uri);
      await restoreDatabase(content);
      showSnackbar('success', t('settings.advancedSettings.localBackups.restoreSuccess'));
      setRestoreModalVisible(false);
      // Wait for snackbar
      setTimeout(async () => {
        await reloadApp();
      }, 1500);
    } catch (error) {
      handleError(error, 'LocalBackupsModal.handleConfirmRestore', {
        snackbarMessage: t('settings.advancedSettings.importFailedMessage'),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = () => {
    setShowMenu(false);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedBackup) {
      return;
    }
    setIsProcessing(true);
    try {
      await deleteBackup(selectedBackup.uri);
      await fetchBackups();
      setDeleteModalVisible(false);
      showSnackbar('success', t('common.success'));
    } catch (error) {
      console.error('Delete failed:', error);
      showSnackbar('error', t('common.deleteFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const canExport = !requireExportEncryption || databaseFailedToInitiate;

  const menuItems: BottomPopUpMenuItem[] = [
    {
      icon: (props) => <MaterialIcons name="share" {...props} />,
      iconColor: canExport ? theme.colors.text.primary : theme.colors.text.tertiary,
      iconBgColor: canExport
        ? theme.colors.background.iconDarker
        : theme.colors.background.darkGray,
      title: t('settings.advancedSettings.localBackups.export'),
      description: canExport ? '' : t('settings.advancedSettings.localBackups.exportDisabled'),
      onPress: canExport ? handleExport : () => {},
    },
    {
      icon: (props) => <MaterialIcons name="restore" {...props} />,
      iconColor: theme.colors.text.primary,
      iconBgColor: theme.colors.background.iconDarker,
      title: t('settings.advancedSettings.localBackups.restore'),
      description: '',
      onPress: handleRestore,
    },
    {
      icon: (props) => <MaterialIcons name="delete" {...props} />,
      iconColor: theme.colors.status.error50,
      iconBgColor: theme.colors.status.error10,
      title: t('settings.advancedSettings.localBackups.delete'),
      description: '',
      onPress: handleDelete,
    },
  ];

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('settings.advancedSettings.localBackups.title')}
    >
      <ScrollView className="mt-6 px-4">
        {isLoading ? (
          <View className="gap-4">
            {[1, 2, 3].map((i) => (
              <SkeletonLoader
                key={i}
                height={80}
                width="100%"
                borderRadius={theme.borderRadius.lg}
              />
            ))}
          </View>
        ) : backups.length === 0 ? (
          <View className="items-center justify-center py-12">
            <MaterialIcons name="backup" size={48} color={theme.colors.text.tertiary} />
            <Text className="mt-4 text-base font-medium text-text-secondary">
              {t('settings.advancedSettings.localBackups.noBackups')}
            </Text>
            <Text className="mt-2 text-center text-sm text-text-tertiary">
              {t('settings.advancedSettings.localBackups.noBackupsDesc')}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {backups.map((backup) => (
              <GenericCard
                key={backup.uri}
                variant="card"
                isPressable
                onPress={() => handleItemPress(backup)}
              >
                <View className="flex-row items-center justify-between p-4">
                  <View className="flex-1 gap-1">
                    <Text className="text-base font-semibold text-text-primary">
                      {t('settings.advancedSettings.localBackups.backupFromTo', {
                        from: backup.fromVersion || '?',
                        to: backup.toVersion || '?',
                      })}
                    </Text>
                    <Text className="text-sm text-text-secondary">
                      {t('settings.advancedSettings.localBackups.backupDate', {
                        date: format(new Date(backup.createdAt), 'PPPp'),
                      })}
                    </Text>
                  </View>
                  <MenuButton onPress={() => handleItemPress(backup)} />
                </View>
              </GenericCard>
            ))}
          </View>
        )}
      </ScrollView>

      <BottomPopUpMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        title={t('settings.advancedSettings.localBackups.title')}
        items={menuItems}
      />

      <ConfirmationModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={handleConfirmDelete}
        title={t('settings.advancedSettings.localBackups.deleteConfirmTitle')}
        message={t('settings.advancedSettings.localBackups.deleteConfirmMessage')}
        confirmLabel={t('common.delete')}
        variant="destructive"
        isLoading={isProcessing}
      />

      <ConfirmationModal
        visible={restoreModalVisible}
        onClose={() => setRestoreModalVisible(false)}
        onConfirm={handleConfirmRestore}
        title={t('settings.advancedSettings.localBackups.restoreConfirmTitle')}
        message={t('settings.advancedSettings.localBackups.restoreConfirmMessage')}
        confirmLabel={t('common.confirm')}
        variant="primary"
        isLoading={isProcessing}
      />
    </FullScreenModal>
  );
}
