import { View, Text, Switch } from 'react-native';
import { theme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';

// TogglableSettings component
export function TogglableSettings({
  darkMode,
  setDarkMode,
  notifications,
  setNotifications,
}: {
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  notifications: boolean;
  setNotifications: (v: boolean) => void;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.background.card,
        borderRadius: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 4,
        shadowColor: theme.colors.accent.primary,
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
          thumbColor={theme.colors.background.white}
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
          thumbColor={theme.colors.background.white}
        />
      </View>
    </View>
  );
}
