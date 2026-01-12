import { View, Text, Pressable } from 'react-native';
import { theme } from '../../theme';

export function SettingsCard({
  icon,
  title,
  subtitle,
  onPress,
  rightIcon,
  titleColor,
  iconContainerStyle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  rightIcon?: React.ReactNode;
  titleColor?: string;
  iconContainerStyle?: object;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.colors.background.overlay,
          borderRadius: theme.borderRadius.lg,
          marginBottom: theme.spacing.padding.sm,
          padding: theme.spacing.padding.base,
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
          style={[
            {
              width: theme.size['12'],
              height: theme.size['12'],
              borderRadius: theme.borderRadius['2xl'],
              backgroundColor: theme.colors.background.iconDark,
              alignItems: 'center',
              justifyContent: 'center',
            },
            iconContainerStyle,
          ]}>
          {icon}
        </View>
        <View>
          <Text
            style={{
              fontSize: theme.typography.fontSize.base,
              fontWeight: theme.typography.fontWeight.bold,
              color: titleColor || theme.colors.text.primary,
            }}>
            {title}
          </Text>
          <Text
            style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.secondary,
              marginTop: theme.spacing.padding.xs / 2,
            }}>
            {subtitle}
          </Text>
        </View>
      </View>
      {rightIcon}
    </Pressable>
  );
}
