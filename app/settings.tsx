import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Switch } from 'react-native';
import { TextInput as ThemedTextInput } from '../components/theme/TextInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { theme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '../components/theme/Button';

// Reusable card for settings
function SettingsCard({
  icon,
  title,
  subtitle,
  onPress,
  rightIcon,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  rightIcon?: React.ReactNode;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.colors.background.overlay,
          borderRadius: 16,
          marginHorizontal: 16,
          marginBottom: 8,
          padding: 16,
          shadowColor: '#000',
          shadowOpacity: 0.03,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
      onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: theme.colors.background.iconDark,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {icon}
        </View>
        <View>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.text.primary }}>
            {title}
          </Text>
          <Text style={{ fontSize: 13, color: theme.colors.text.secondary, marginTop: 2 }}>
            {subtitle}
          </Text>
        </View>
      </View>
      {rightIcon}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [search, setSearch] = useState('');

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background.primary }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          backgroundColor: theme.colors.background.primary,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border.dark,
        }}>
        <Pressable
          style={({ pressed }) => [
            {
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? theme.colors.background.overlay : 'transparent',
            },
          ]}
          onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </Pressable>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            pointerEvents: 'none',
          }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: theme.colors.text.primary,
              textAlign: 'center',
            }}>
            Settings
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
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
          onPress={() => router.push('/settings/basic')}
          rightIcon={
            <MaterialIcons name="chevron-right" size={24} color={theme.colors.text.secondary} />
          }
        />

        <SettingsCard
          icon={<MaterialIcons name="tune" size={28} color={theme.colors.accent.primary} />}
          title="Advanced Settings"
          subtitle="Data export, integrations, cache"
          onPress={() => router.push('/settings/advanced')}
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

        {/* Toggles Section */}
        <View
          style={{
            backgroundColor: theme.colors.background.card,
            borderRadius: 16,
            marginHorizontal: 16,
            marginBottom: 16,
            padding: 4,
            shadowColor: '#000',
            shadowOpacity: 0.03,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
          }}>
          {/* Dark Mode */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="dark-mode" size={22} color={theme.colors.text.secondary} />
              <Text style={{ fontSize: 15, color: theme.colors.text.primary, fontWeight: '500' }}>
                Dark Mode
              </Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{
                false: theme.colors.background.overlay,
                true: theme.colors.accent.primary,
              }}
              thumbColor={darkMode ? '#fff' : '#fff'}
            />
          </View>
          <View
            style={{ height: 1, backgroundColor: theme.colors.border.light, marginHorizontal: 8 }}
          />
          {/* Notifications */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="notifications" size={22} color={theme.colors.text.secondary} />
              <Text style={{ fontSize: 15, color: theme.colors.text.primary, fontWeight: '500' }}>
                Notifications
              </Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{
                false: theme.colors.background.overlay,
                true: theme.colors.accent.primary,
              }}
              thumbColor={notifications ? '#fff' : '#fff'}
            />
          </View>
        </View>

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
      </ScrollView>
    </View>
  );
}
