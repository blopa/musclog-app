import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { TextInput as ThemedTextInput } from './theme/TextInput';
import { theme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from './theme/Button';
import { FullScreenModal } from './FullScreenModal';
import { SettingsCard } from './SettingsCard';
import { TogglableSettings } from './TogglableSettings';

export function MainSettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [search, setSearch] = useState('');

  return (
    <FullScreenModal visible={visible} onClose={onClose} title="Settings">
      <View style={{ flex: 1 }}>
        <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 8 }}>
          <ThemedTextInput
            label=""
            value={search}
            onChangeText={setSearch}
            placeholder="Search settings"
            icon={<MaterialIcons name="search" size={20} color={theme.colors.text.secondary} />}
          />
        </View>

        {/* Configuration Section */}
        <Text
          style={{
            marginLeft: 20,
            marginTop: 8,
            marginBottom: 8,
            fontSize: 13,
            fontWeight: 'bold',
            color: theme.colors.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
          }}>
          Configuration
        </Text>

        <SettingsCard
          icon={<MaterialIcons name="settings" size={28} color={theme.colors.accent.primary} />}
          title="Basic Settings"
          subtitle="Profile, units, and preferences"
          onPress={() => {}}
          rightIcon={
            <MaterialIcons name="chevron-right" size={24} color={theme.colors.text.secondary} />
          }
        />

        <SettingsCard
          icon={<MaterialIcons name="tune" size={28} color={theme.colors.accent.primary} />}
          title="Advanced Settings"
          subtitle="Data export, integrations, cache"
          onPress={() => {}}
          rightIcon={
            <MaterialIcons name="chevron-right" size={24} color={theme.colors.text.secondary} />
          }
        />

        {/* Divider */}
        <View
          style={{
            height: 1,
            backgroundColor: theme.colors.border.light,
            marginVertical: 12,
            marginHorizontal: 16,
          }}
        />

        <TogglableSettings
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          notifications={notifications}
          setNotifications={setNotifications}
        />

        {/* Info Links */}
        <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <Pressable
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: pressed ? theme.colors.background.overlay : 'transparent',
              },
            ]}
            onPress={() => {}}>
            <Text style={{ fontSize: 15, color: theme.colors.text.primary, fontWeight: '500' }}>
              About Musclog
            </Text>
            <Text style={{ fontSize: 12, color: theme.colors.text.secondary }}>v1.0.4</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: pressed ? theme.colors.background.overlay : 'transparent',
              },
            ]}
            onPress={() => {}}>
            <Text style={{ fontSize: 15, color: theme.colors.text.primary, fontWeight: '500' }}>
              Privacy Policy
            </Text>
          </Pressable>
        </View>

        <View style={{ marginHorizontal: 16, marginTop: 12 }}>
          <Button label="Sign Out" variant="discard" width="full" size="sm" onPress={() => {}} />
        </View>

        {/* Spacer for bottom nav */}
        <View style={{ height: 32 }} />
      </View>
    </FullScreenModal>
  );
}
