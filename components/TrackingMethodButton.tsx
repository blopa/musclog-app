import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, ChevronRight, LucideIcon } from 'lucide-react-native';
import { Platform, Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type TrackingMethodButtonProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  iconBgColor?: string;
  iconGradient?: readonly [string, string, ...string[]];
  highlighted?: boolean;
  onPress: () => void;
};

export function TrackingMethodButton({
  icon: Icon,
  title,
  description,
  iconBgColor,
  iconGradient,
  highlighted = false,
  onPress,
}: TrackingMethodButtonProps) {
  const theme = useTheme();
  const IconContainer = iconGradient ? (
    <LinearGradient
      colors={iconGradient as readonly [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        height: theme.size['12'],
        width: theme.size['12'],
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.borderRadius.xl,
        overflow: 'hidden',
        ...theme.shadows.md,
      }}
    >
      <Icon size={theme.iconSize.lg} color={theme.colors.text.primary} />
    </LinearGradient>
  ) : (
    <View
      className="h-10 w-10 items-center justify-center rounded-lg"
      style={{ backgroundColor: iconBgColor || theme.colors.background.secondaryDark }}
    >
      <Icon size={theme.iconSize.md} color={theme.colors.text.primary} />
    </View>
  );

  return (
    <Pressable
      className={`flex-row items-center gap-4 rounded-2xl border p-4 active:scale-[0.98] ${
        highlighted
          ? 'active:bg-bg-card-elevated bg-bg-overlay'
          : 'active:bg-bg-card-elevated border-border-default bg-bg-overlay'
      }`}
      style={{
        borderColor: highlighted ? theme.colors.accent.primary40 : theme.colors.border.default,
      }}
      onPress={onPress}
      {...(Platform.OS === 'android' && { unstable_pressDelay: 130 })}
    >
      {IconContainer}
      <View className="flex-1">
        <Text className="text-lg font-bold text-text-primary">{title}</Text>
        <Text className="mt-0.5 text-xs text-text-secondary">{description}</Text>
      </View>
      {highlighted ? (
        <ArrowRight size={theme.iconSize.md} color={theme.colors.accent.primary} />
      ) : (
        <ChevronRight size={theme.iconSize.md} color={theme.colors.text.secondary} />
      )}
    </Pressable>
  );
}
