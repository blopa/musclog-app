import React from 'react';
import { View, Text } from 'react-native';
import { Download, Upload, Bug, Trash2, ChevronRight } from 'lucide-react-native';
import { FullScreenModal } from './FullScreenModal';
import { SettingsCard } from './SettingsCard';
import { ToggleInput } from './theme/ToggleInput';
import { theme } from '../theme';

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
  // Version info
  version?: string;
  build?: string;
};

export function AdvancedSettingsModal({
  visible,
  onClose,
  onExportPress,
  onImportPress,
  anonymousBugReport = true,
  onAnonymousBugReportChange,
  onAccountDeletionPress,
  version = '2.4.0',
  build = '1024',
}: AdvancedSettingsModalProps) {
  const bugReportItems = [
    {
      key: 'bug-report',
      label: 'Anonymous Bug Report',
      subtitle: 'Help improve Musclog by sending crash logs',
      icon: (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: theme.colors.status.purple20,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Bug size={24} color={theme.colors.status.purple} />
        </View>
      ),
      value: anonymousBugReport,
      onValueChange: onAnonymousBugReportChange || (() => {}),
    },
  ];

  return (
    <FullScreenModal visible={visible} onClose={onClose} title="Advanced Settings">
      <View className="gap-6 px-4 py-6" style={{ minHeight: '100%' }}>
        {/* Data Portability Section */}
        <View>
          <Text
            className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.text.secondary }}>
            DATA PORTABILITY
          </Text>
          <SettingsCard
            icon={<Download size={24} color={theme.colors.accent.primary} />}
            iconContainerStyle={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: theme.colors.accent.primary20,
            }}
            title="Export Fitness Data"
            subtitle="CSV/JSON format"
            onPress={onExportPress || (() => {})}
            rightIcon={<ChevronRight size={20} color={theme.colors.text.tertiary} />}
          />
          <SettingsCard
            icon={<Upload size={24} color={theme.colors.accent.primary} />}
            iconContainerStyle={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: theme.colors.accent.primary20,
            }}
            title="Import Fitness Data"
            subtitle="Restore backup"
            onPress={onImportPress || (() => {})}
            rightIcon={<ChevronRight size={20} color={theme.colors.text.tertiary} />}
          />
        </View>

        {/* Privacy & Diagnostics Section */}
        <View>
          <Text
            className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.text.secondary }}>
            PRIVACY & DIAGNOSTICS
          </Text>
          <ToggleInput items={bugReportItems} />
        </View>

        {/* Danger Zone Section */}
        <View style={{ paddingTop: 32 }}>
          <Text
            className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.status.error }}>
            DANGER ZONE
          </Text>
          <SettingsCard
            icon={<Trash2 size={24} color={theme.colors.status.error} />}
            iconContainerStyle={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: theme.colors.status.error20,
            }}
            title="Request Account Deletion"
            subtitle="Permanently remove all data"
            titleColor={theme.colors.status.error}
            onPress={onAccountDeletionPress || (() => {})}
            rightIcon={<ChevronRight size={20} color={theme.colors.status.error} />}
          />

          {/* Version Info */}
          <Text
            className="mt-3 px-4 text-center text-xs"
            style={{ color: theme.colors.text.tertiary }}>
            Version {version} (Build {build})
          </Text>
        </View>
      </View>
    </FullScreenModal>
  );
}
