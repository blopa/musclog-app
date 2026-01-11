import { View, Text, Pressable } from 'react-native';
import { theme } from '../theme';

export function SettingsCard({
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
          shadowColor: theme.colors.accent.primary,
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
