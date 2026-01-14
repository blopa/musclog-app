import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Settings, Sun, Moon, ChevronRight, Heart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FullScreenModal } from './FullScreenModal';
import { SettingsCard } from '../cards/SettingsCard';
import { SegmentedControl } from '../theme/SegmentedControl';
import { ToggleInput } from '../theme/ToggleInput';
import { theme } from '../../theme';

type ThemeOption = 'system' | 'light' | 'dark';

type BasicSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  // Theme settings
  themeValue?: ThemeOption;
  onThemeChange?: (value: ThemeOption) => void;
  // Language settings
  language?: string;
  onLanguagePress?: () => void;
  // Health data settings
  connectHealthData?: boolean;
  onConnectHealthDataChange?: (value: boolean) => void;
  readHealthData?: boolean;
  onReadHealthDataChange?: (value: boolean) => void;
  writeHealthData?: boolean;
  onWriteHealthDataChange?: (value: boolean) => void;
};

export function BasicSettingsModal({
  visible,
  onClose,
  themeValue = 'system',
  onThemeChange,
  language = 'English (US)',
  onLanguagePress,
  connectHealthData = false,
  onConnectHealthDataChange,
  readHealthData = true,
  onReadHealthDataChange,
  writeHealthData = false,
  onWriteHealthDataChange,
}: BasicSettingsModalProps) {
  const { t } = useTranslation();
  const themeOptions = [
    {
      value: 'system',
      label: t('settings.basicSettings.themeSystem'),
      icon: (
        <Settings
          size={18}
          color={themeValue === 'system' ? theme.colors.accent.primary : theme.colors.text.tertiary}
        />
      ),
    },
    {
      value: 'light',
      label: t('settings.basicSettings.themeLight'),
      icon: (
        <Sun
          size={18}
          color={themeValue === 'light' ? theme.colors.accent.primary : theme.colors.text.tertiary}
        />
      ),
    },
    {
      value: 'dark',
      label: t('settings.basicSettings.themeDark'),
      icon: (
        <Moon
          size={18}
          color={themeValue === 'dark' ? theme.colors.accent.primary : theme.colors.text.tertiary}
        />
      ),
    },
  ];

  const healthSettingsItems = [
    {
      key: 'connect',
      label: t('settings.basicSettings.connectHealthData'),
      value: connectHealthData,
      onValueChange: onConnectHealthDataChange || (() => {}),
    },
    {
      key: 'read',
      label: t('settings.basicSettings.readHealthData'),
      value: readHealthData,
      onValueChange: onReadHealthDataChange || (() => {}),
    },
    {
      key: 'write',
      label: t('settings.basicSettings.writeHealthData'),
      value: writeHealthData,
      onValueChange: onWriteHealthDataChange || (() => {}),
    },
  ];

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={t('settings.basicSettings.title')}>
      <View className="gap-8 py-6">
        {/* Appearance Section */}
        <View>
          <Text className="mb-3 px-5 text-lg font-bold tracking-tight text-text-primary">
            {t('settings.basicSettings.appearance')}
          </Text>
          <View
            style={{
              backgroundColor: theme.colors.background.card,
              borderRadius: 16,
              marginHorizontal: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: theme.colors.border.light,
            }}>
            <Text className="mb-3 text-sm font-medium text-text-secondary">
              {t('settings.basicSettings.appTheme')}
            </Text>
            <SegmentedControl
              options={themeOptions}
              value={themeValue}
              onValueChange={(val) => onThemeChange?.(val as ThemeOption)}
            />
          </View>
        </View>

        {/* Localization Section */}
        <View
          style={{
            marginHorizontal: theme.spacing.padding.base,
          }}>
          <Text className="mb-3 px-5 text-lg font-bold tracking-tight text-text-primary">
            {t('settings.basicSettings.localization')}
          </Text>
          <SettingsCard
            title={t('settings.basicSettings.language')}
            subtitle={t('settings.basicSettings.languageSubtitle')}
            onPress={onLanguagePress || (() => {})}
            icon={<Settings size={24} color={theme.colors.text.primary} />}
            rightIcon={
              <View className="flex-row items-center gap-2">
                <Text
                  className="text-sm font-medium"
                  style={{ color: theme.colors.accent.primary }}>
                  {language}
                </Text>
                <ChevronRight size={16} color={theme.colors.text.tertiary} />
              </View>
            }
          />
        </View>

        {/* Integrations Section */}
        <View
          style={{
            marginHorizontal: theme.spacing.padding.base,
          }}>
          <Text className="mb-3 px-5 text-lg font-bold tracking-tight text-text-primary">
            Integrations
          </Text>

          <ToggleInput
            items={healthSettingsItems}
            header={
              <LinearGradient
                colors={[
                  theme.colors.status.purple40,
                  theme.colors.accent.secondary10,
                  'transparent',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="border-b p-4"
                style={{
                  borderBottomColor: theme.colors.border.light,
                }}>
                <View className="mb-2 flex-row items-center gap-3">
                  <View
                    className="h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: theme.colors.background.white }}>
                    <Heart
                      size={24}
                      color={theme.colors.status.error}
                      fill={theme.colors.status.error}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-text-primary">
                      {t('settings.basicSettings.healthData')}
                    </Text>
                    <Text className="text-xs text-text-secondary">
                      {t('settings.basicSettings.healthDataSubtitle')}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            }
          />

          <Text
            className="mt-0 px-8 text-center text-xs"
            style={{ color: theme.colors.text.tertiary }}>
            {t('settings.basicSettings.healthDataPrivacy')}
          </Text>
        </View>
      </View>
    </FullScreenModal>
  );
}
