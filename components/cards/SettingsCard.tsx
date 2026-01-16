import { View, Text } from 'react-native';
import { theme } from '../../theme';
import { GenericCard } from './GenericCard';

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
    <View style={{ marginBottom: theme.spacing.padding.sm }}>
      <GenericCard variant="default" size="sm" isPressable={true} onPress={onPress}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: theme.spacing.padding.base,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.gap.base }}>
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
                  marginTop: theme.spacing.padding.xsHalf,
                }}>
                {subtitle}
              </Text>
            </View>
          </View>
          {rightIcon}
        </View>
      </GenericCard>
    </View>
  );
}
