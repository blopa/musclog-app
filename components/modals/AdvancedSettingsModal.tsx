import { Bug, ChevronRight, Download, Trash2, Upload } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import packageJson from '../../package.json';
import { SettingsCard } from '../cards/SettingsCard';
import { ToggleInput } from '../theme/ToggleInput';
import { FullScreenModal } from './FullScreenModal';

type AdvancedSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  // Data Portability
  onExportPress?: () => void;
  onImportPress?: () => void;
  // Privacy & Diagnostics
  anonymousBugReport?: boolean;
  onAnonymousBugReportChange?: (value: boolean) => void;
  // Danger Zone
  onAccountDeletionPress?: () => void;
};

export function AdvancedSettingsModal({
  visible,
  onClose,
  onExportPress,
  onImportPress,
  anonymousBugReport = true,
  onAnonymousBugReportChange,
  onAccountDeletionPress,
}: AdvancedSettingsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const bugReportItems = [
    {
      key: 'bug-report',
      label: t('settings.advancedSettings.anonymousBugReport'),
      subtitle: t('settings.advancedSettings.anonymousBugReportSubtitle'),
      icon: (
        <View
          style={{
            width: theme.size['10'],
            height: theme.size['10'],
            borderRadius: theme.borderRadius.sm,
            backgroundColor: theme.colors.status.purple20,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bug size={theme.iconSize.xl} color={theme.colors.status.purple} />
        </View>
      ),
      value: anonymousBugReport,
      onValueChange: onAnonymousBugReportChange || (() => {}),
    },
  ];

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('settings.advancedSettings.title')}
    >
      <View className="gap-6 px-4 py-6" style={{ minHeight: '100%' }}>
        {/* Data Portability Section */}
        <View>
          <Text
            className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('settings.advancedSettings.dataPortability')}
          </Text>
          {/* TODO: make import and export work */}
          <SettingsCard
            icon={<Download size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
            iconContainerStyle={{
              width: theme.size['16'],
              height: theme.size['16'],
              borderRadius: theme.borderRadius.sm,
              backgroundColor: theme.colors.accent.primary20,
            }}
            title={t('settings.advancedSettings.exportFitnessData')}
            subtitle={t('settings.advancedSettings.exportFitnessDataSubtitle')}
            onPress={onExportPress || (() => {})}
            rightIcon={<ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
          />
          <SettingsCard
            icon={<Upload size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
            iconContainerStyle={{
              width: theme.size['16'],
              height: theme.size['16'],
              borderRadius: theme.borderRadius.sm,
              backgroundColor: theme.colors.accent.primary20,
            }}
            title={t('settings.advancedSettings.importFitnessData')}
            subtitle={t('settings.advancedSettings.importFitnessDataSubtitle')}
            onPress={onImportPress || (() => {})}
            rightIcon={<ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
          />
        </View>

        {/* Privacy & Diagnostics Section */}
        <View>
          <Text
            className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('settings.advancedSettings.privacyDiagnostics')}
          </Text>
          <ToggleInput items={bugReportItems} />
        </View>

        {/* TODO: simply open the Android cache and data settings from the app, since all data is stored locally */}
        <View style={{ paddingTop: theme.spacing.padding['2xl'] }}>
          <Text
            className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.status.error }}
          >
            {t('settings.advancedSettings.dangerZone')}
          </Text>
          <SettingsCard
            icon={<Trash2 size={theme.iconSize.xl} color={theme.colors.status.error} />}
            iconContainerStyle={{
              width: theme.size['16'],
              height: theme.size['16'],
              borderRadius: theme.borderRadius.sm,
              backgroundColor: theme.colors.status.error20,
            }}
            title={t('settings.advancedSettings.requestAccountDeletion')}
            subtitle={t('settings.advancedSettings.requestAccountDeletionSubtitle')}
            titleColor={theme.colors.status.error}
            onPress={onAccountDeletionPress || (() => {})}
            rightIcon={<ChevronRight size={theme.iconSize.lg} color={theme.colors.status.error} />}
          />

          {/* Version Info */}
          <Text
            className="mt-3 px-4 text-center text-xs"
            style={{ color: theme.colors.text.tertiary }}
          >
            {t('settings.advancedSettings.version', { version: packageJson.version })}
          </Text>
        </View>
      </View>
    </FullScreenModal>
  );
}
