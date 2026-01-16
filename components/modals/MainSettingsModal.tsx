import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TextInput as ThemedTextInput } from '../theme/TextInput';
import { theme } from '../../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '../theme/Button';
import { FullScreenModal } from './FullScreenModal';
import { SettingsCard } from '../cards/SettingsCard';
import { ToggleInput } from '../theme/ToggleInput';

export function MainSettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [search, setSearch] = useState('');

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={t('settings.title')}>
      <View
        style={{
          flex: 1,
          marginHorizontal: theme.spacing.padding.base,
        }}>
        <View
          style={{
            marginTop: theme.spacing.padding.base,
            marginBottom: theme.spacing.padding.sm,
          }}>
          <ThemedTextInput
            label=""
            value={search}
            onChangeText={setSearch}
            placeholder={t('settings.searchPlaceholder')}
            icon={
              <MaterialIcons
                name="search"
                size={theme.iconSize.lg}
                color={theme.colors.text.secondary}
              />
            }
          />
        </View>

        {/* Configuration Section */}
        <Text
          style={{
            marginLeft: theme.spacing.padding['5'],
            marginTop: theme.spacing.padding.sm,
            marginBottom: theme.spacing.padding.sm,
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: theme.typography.letterSpacing.widest,
          }}>
          {t('settings.configuration')}
        </Text>

        <SettingsCard
          icon={
            <MaterialIcons
              name="settings"
              size={theme.iconSize['2xl']}
              color={theme.colors.accent.primary}
            />
          }
          title={t('settings.basicSettings.title')}
          subtitle={t('settings.basicSettings.subtitle')}
          onPress={() => {}}
          rightIcon={
            <MaterialIcons name="chevron-right" size={24} color={theme.colors.text.secondary} />
          }
        />

        <SettingsCard
          icon={
            <MaterialIcons
              name="tune"
              size={theme.iconSize['2xl']}
              color={theme.colors.accent.primary}
            />
          }
          title={t('settings.advancedSettings.title')}
          subtitle={t('settings.advancedSettings.subtitle')}
          onPress={() => {}}
          rightIcon={
            <MaterialIcons name="chevron-right" size={24} color={theme.colors.text.secondary} />
          }
        />

        {/* Divider */}
        <View
          style={{
            height: theme.borderWidth.thin,
            backgroundColor: theme.colors.border.light,
            marginVertical: theme.spacing.padding.md,
          }}
        />

        <ToggleInput
          items={[
            {
              key: 'darkMode',
              label: t('settings.darkMode'),
              icon: (
                <MaterialIcons
                  name="dark-mode"
                  size={theme.iconSize.xl}
                  color={theme.colors.text.secondary}
                />
              ),
              value: darkMode,
              onValueChange: setDarkMode,
            },
            {
              key: 'notifications',
              label: t('settings.notifications'),
              icon: (
                <MaterialIcons
                  name="notifications"
                  size={theme.iconSize.xl}
                  color={theme.colors.text.secondary}
                />
              ),
              value: notifications,
              onValueChange: setNotifications,
            },
          ]}
        />

        {/* Info Links */}
        <View
          style={{
            marginBottom: theme.spacing.padding.sm,
          }}>
          <Pressable
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: theme.borderRadius.md,
                paddingVertical: theme.spacing.padding.md,
                paddingHorizontal: theme.spacing.padding.base,
                backgroundColor: pressed ? theme.colors.background.overlay : 'transparent',
              },
            ]}
            onPress={() => {}}>
            <Text
              style={{
                fontSize: theme.typography.fontSize['15'],
                color: theme.colors.text.primary,
                fontWeight: theme.typography.fontWeight.medium,
              }}>
              {t('settings.aboutMusclog')}
            </Text>
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.secondary,
              }}>
              v1.0.4
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: theme.borderRadius.md,
                paddingVertical: theme.spacing.padding.md,
                paddingHorizontal: theme.spacing.padding.base,
                backgroundColor: pressed ? theme.colors.background.overlay : 'transparent',
              },
            ]}
            onPress={() => {}}>
            <Text
              style={{
                fontSize: theme.typography.fontSize['15'],
                color: theme.colors.text.primary,
                fontWeight: theme.typography.fontWeight.medium,
              }}>
              {t('settings.privacyPolicy')}
            </Text>
          </Pressable>
        </View>

        <View
          style={{
            marginTop: theme.spacing.padding.md,
          }}>
          <Button
            label={t('settings.signOut')}
            variant="discard"
            width="full"
            size="sm"
            onPress={() => {}}
          />
        </View>

        {/* Spacer for bottom nav */}
        <View style={{ height: theme.size['8'] }} />
      </View>
    </FullScreenModal>
  );
}
