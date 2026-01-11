import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Switch } from 'react-native';
import { TextInput as ThemedTextInput } from '../components/theme/TextInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { theme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';

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
          style={({ pressed }) => [{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? theme.colors.background.overlay : 'transparent',
          }]}
          onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, pointerEvents: 'none' }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.text.primary, textAlign: 'center' }}>
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

        {/* Basic Settings Card */}
        <Pressable
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: theme.colors.background.card,
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
          onPress={() => router.push('/settings/basic')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: theme.colors.background.imageLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <MaterialIcons name="settings" size={28} color={theme.colors.accent.primary} />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.text.primary }}>
                Basic Settings
              </Text>
              <Text style={{ fontSize: 13, color: theme.colors.text.secondary, marginTop: 2 }}>
                Profile, units, and preferences
              </Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={theme.colors.text.secondary} />
        </Pressable>

        {/* Advanced Settings Card */}
        <Pressable
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: theme.colors.background.card,
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
          onPress={() => router.push('/settings/advanced')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: theme.colors.background.imageLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <MaterialIcons name="tune" size={28} color={theme.colors.accent.primary} />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.text.primary }}>
                Advanced Settings
              </Text>
              <Text style={{ fontSize: 13, color: theme.colors.text.secondary, marginTop: 2 }}>
                Data export, integrations, cache
              </Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={theme.colors.text.secondary} />
        </Pressable>

        {/* AI Coach Card (Gradient Border) */}
        <Pressable
          style={({ pressed }) => [
            {
              marginHorizontal: 16,
              marginBottom: 8,
              borderRadius: 16,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              transform: [{ scale: pressed ? 0.99 : 1 }],
              borderWidth: 0,
            },
          ]}
          onPress={() => router.push('/settings/ai-coach')}>
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: 'transparent',
              borderRadius: 16,
              borderWidth: 0,
              zIndex: 0,
            }}>
            {/* Simulate gradient border with overlay */}
            <View
              style={{
                flex: 1,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: 'rgba(99,102,241,0.7)', // Indigo
                borderStyle: 'solid',
                opacity: 0.7,
              }}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: theme.colors.background.card,
              borderRadius: 16,
              padding: 16,
              zIndex: 1,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: theme.colors.accent.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <MaterialIcons name="auto-awesome" size={28} color={'#fff'} />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text
                    style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.text.primary }}>
                    AI Coach
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: 'bold',
                      color: theme.colors.accent.primary,
                      backgroundColor: theme.colors.accent.primary + '33',
                      borderRadius: 8,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      marginLeft: 4,
                    }}>
                    PRO
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: theme.colors.text.secondary, marginTop: 2 }}>
                  Personalization & generation
                </Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={theme.colors.accent.primary} />
          </View>
        </Pressable>

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

        {/* Danger Zone */}
        <Pressable
          style={({ pressed }) => [
            {
              marginHorizontal: 16,
              marginTop: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#fca5a5',
              backgroundColor: pressed ? '#f87171' : '#fef2f2',
              padding: 16,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
          onPress={() => {}}>
          <Text style={{ color: '#dc2626', fontWeight: 'bold', fontSize: 15 }}>Sign Out</Text>
        </Pressable>

        {/* Spacer for bottom nav */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}
