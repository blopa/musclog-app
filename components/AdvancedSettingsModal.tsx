import React from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { Download, Upload, Bug, Trash2, ChevronRight } from 'lucide-react-native';
import { FullScreenModal } from './FullScreenModal';
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
  return (
    <FullScreenModal visible={visible} onClose={onClose} title="Advanced Settings">
      <View className="gap-6 px-4 py-6" style={{ minHeight: '100%' }}>
        {/* Data Portability Section */}
        <View>
          <Text
            className="mb-2 px-1 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.text.secondary }}>
            DATA PORTABILITY
          </Text>
          <View
            style={{
              backgroundColor: theme.colors.background.card,
              borderRadius: 16,
              marginHorizontal: 16,
              borderWidth: 1,
              borderColor: theme.colors.border.light,
              overflow: 'hidden',
            }}>
            {/* Export Item */}
            <Pressable
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  backgroundColor: pressed ? theme.colors.background.overlay : undefined,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border.light,
                },
              ]}
              onPress={onExportPress}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: theme.colors.accent.primary20,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Download size={24} color={theme.colors.accent.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: theme.colors.text.primary,
                      marginBottom: 2,
                    }}>
                    Export Fitness Data
                  </Text>
                  <Text style={{ fontSize: 14, color: theme.colors.text.secondary }}>
                    CSV/JSON format
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={theme.colors.text.tertiary} />
            </Pressable>

            {/* Import Item */}
            <Pressable
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  backgroundColor: pressed ? theme.colors.background.overlay : undefined,
                },
              ]}
              onPress={onImportPress}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: theme.colors.accent.primary20,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Upload size={24} color={theme.colors.accent.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: theme.colors.text.primary,
                      marginBottom: 2,
                    }}>
                    Import Fitness Data
                  </Text>
                  <Text style={{ fontSize: 14, color: theme.colors.text.secondary }}>
                    Restore backup
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={theme.colors.text.tertiary} />
            </Pressable>
          </View>
        </View>

        {/* Privacy & Diagnostics Section */}
        <View>
          <Text
            className="mb-2 px-1 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.text.secondary }}>
            PRIVACY & DIAGNOSTICS
          </Text>
          <View
            style={{
              backgroundColor: theme.colors.background.card,
              borderRadius: 16,
              marginHorizontal: 16,
              borderWidth: 1,
              borderColor: theme.colors.border.light,
              overflow: 'hidden',
            }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 }}>
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
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: theme.colors.text.primary,
                      marginBottom: 2,
                    }}>
                    Anonymous Bug Report
                  </Text>
                  <Text style={{ fontSize: 14, color: theme.colors.text.secondary }}>
                    Help improve Musclog by sending crash logs
                  </Text>
                </View>
              </View>
              <Switch
                value={anonymousBugReport}
                onValueChange={onAnonymousBugReportChange}
                trackColor={{
                  false: theme.colors.background.cardElevated,
                  true: theme.colors.accent.primary,
                }}
                thumbColor={theme.colors.background.white}
              />
            </View>
          </View>
        </View>

        {/* Danger Zone Section */}
        <View style={{ paddingTop: 32 }}>
          <Text
            className="mb-2 px-1 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.status.error }}>
            DANGER ZONE
          </Text>
          <View
            style={{
              backgroundColor: theme.colors.background.card,
              borderRadius: 16,
              marginHorizontal: 16,
              borderWidth: 1,
              borderColor: theme.colors.status.error20,
              overflow: 'hidden',
            }}>
            <Pressable
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  backgroundColor: pressed ? theme.colors.status.error8 : undefined,
                },
              ]}
              onPress={onAccountDeletionPress}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: theme.colors.status.error20,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Trash2 size={24} color={theme.colors.status.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: theme.colors.status.error,
                      marginBottom: 2,
                    }}>
                    Request Account Deletion
                  </Text>
                  <Text style={{ fontSize: 14, color: theme.colors.text.secondary }}>
                    Permanently remove all data
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={theme.colors.status.error} />
            </Pressable>
          </View>

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
