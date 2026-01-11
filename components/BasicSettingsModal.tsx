import React from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { Settings, Sun, Moon, ChevronRight, Heart } from 'lucide-react-native';
import { FullScreenModal } from './FullScreenModal';
import { theme } from '../theme';

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
  const themeOptions: { value: ThemeOption; label: string; icon: typeof Settings }[] = [
    { value: 'system', label: 'System', icon: Settings },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
  ];

  return (
    <FullScreenModal visible={visible} onClose={onClose} title="Basic Settings">
      <View className="gap-8 px-4 py-6">
        {/* Appearance Section */}
        <View>
          <Text className="mb-3 px-1 text-lg font-bold tracking-tight text-text-primary">
            Appearance
          </Text>
          <View
            className="rounded-xl p-4"
            style={{
              backgroundColor: theme.colors.background.card,
              borderWidth: 1,
              borderColor: theme.colors.border.light,
            }}>
            <Text className="mb-3 text-sm font-medium text-text-secondary">App Theme</Text>
            <View
              className="flex-row rounded-xl p-1.5"
              style={{ backgroundColor: theme.colors.background.cardElevated }}>
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = themeValue === option.value;
                return (
                  <Pressable
                    key={option.value}
                    className="flex-1 rounded-lg py-2"
                    style={{
                      backgroundColor: isSelected ? theme.colors.background.card : 'transparent',
                    }}
                    onPress={() => onThemeChange?.(option.value)}>
                    <View className="flex-row items-center justify-center gap-1.5">
                      <Icon
                        size={18}
                        color={
                          isSelected ? theme.colors.accent.primary : theme.colors.text.tertiary
                        }
                      />
                      <Text
                        className="text-sm font-medium"
                        style={{
                          color: isSelected
                            ? theme.colors.accent.primary
                            : theme.colors.text.tertiary,
                        }}>
                        {option.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Localization Section */}
        <View>
          <Text className="mb-3 px-1 text-lg font-bold tracking-tight text-text-primary">
            Localization
          </Text>
          <Pressable
            onPress={onLanguagePress}
            style={({ pressed }) => [
              {
                backgroundColor: theme.colors.background.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.colors.border.light,
                padding: 16,
                transform: [{ scale: pressed ? 0.99 : 1 }],
              },
            ]}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-medium text-text-primary">Language</Text>
                <Text className="mt-0.5 text-xs text-text-secondary">
                  Choose your preferred language
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text
                  className="text-sm font-medium"
                  style={{ color: theme.colors.accent.primary }}>
                  {language}
                </Text>
                <ChevronRight size={16} color={theme.colors.text.tertiary} />
              </View>
            </View>
          </Pressable>
        </View>

        {/* Integrations Section */}
        <View>
          <Text className="mb-3 px-1 text-lg font-bold tracking-tight text-text-primary">
            Integrations
          </Text>
          <View
            className="overflow-hidden rounded-xl"
            style={{
              backgroundColor: theme.colors.background.card,
              borderWidth: 1,
              borderColor: theme.colors.border.light,
            }}>
            {/* Header Card */}
            <View
              className="border-b p-4"
              style={{
                borderBottomColor: theme.colors.border.light,
                backgroundColor: theme.colors.status.error8, // Red tint background
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
                  <Text className="text-base font-semibold text-text-primary">Health Data</Text>
                  <Text className="text-xs text-text-secondary">
                    Sync your workouts and body metrics
                  </Text>
                </View>
              </View>
            </View>

            {/* Master Toggle */}
            <View
              className="flex-row items-center justify-between border-b p-4"
              style={{ borderBottomColor: theme.colors.border.light }}>
              <Text className="text-sm font-medium text-text-primary">Connect Health Data</Text>
              <Switch
                value={connectHealthData}
                onValueChange={onConnectHealthDataChange}
                trackColor={{
                  false: theme.colors.background.cardElevated,
                  true: theme.colors.accent.primary,
                }}
                thumbColor={theme.colors.background.white}
              />
            </View>

            {/* Sub Toggles */}
            <View
              className="gap-5 p-4"
              style={{ backgroundColor: theme.colors.background.cardDark }}>
              {/* Read Health Data */}
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-4">
                  <Text className="text-sm font-medium text-text-primary">Read Health Data</Text>
                  <Text className="mt-0.5 text-xs text-text-secondary">
                    Allows Musclog to import weight, steps, and heart rate.
                  </Text>
                </View>
                <Switch
                  value={readHealthData}
                  onValueChange={onReadHealthDataChange}
                  trackColor={{
                    false: theme.colors.background.cardElevated,
                    true: theme.colors.accent.primary,
                  }}
                  thumbColor={theme.colors.background.white}
                />
              </View>

              {/* Write Health Data */}
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-4">
                  <Text className="text-sm font-medium text-text-primary">Write Health Data</Text>
                  <Text className="mt-0.5 text-xs text-text-secondary">
                    Allows Musclog to save completed workouts to Health.
                  </Text>
                </View>
                <Switch
                  value={writeHealthData}
                  onValueChange={onWriteHealthDataChange}
                  trackColor={{
                    false: theme.colors.background.cardElevated,
                    true: theme.colors.accent.primary,
                  }}
                  thumbColor={theme.colors.background.white}
                />
              </View>
            </View>
          </View>

          {/* Privacy Statement */}
          <Text
            className="mt-4 px-8 text-center text-xs"
            style={{ color: theme.colors.text.tertiary }}>
            Data privacy is important to us. Your health data is never shared with third parties
            without your consent.
          </Text>
        </View>
      </View>
    </FullScreenModal>
  );
}
