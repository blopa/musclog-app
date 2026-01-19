import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LucideIcon, ArrowRight, ChevronRight } from 'lucide-react-native';
import { theme } from '../theme';

type TrackingMethodButtonProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  iconBgColor?: string;
  iconGradient?: readonly [string, string, ...string[]];
  badge?: string;
  highlighted?: boolean;
  onPress: () => void;
};

export function TrackingMethodButton({
  icon: Icon,
  title,
  description,
  iconBgColor,
  iconGradient,
  badge,
  highlighted = false,
  onPress,
}: TrackingMethodButtonProps) {
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
      <Icon size={theme.iconSize.lg} color={theme.colors.text.white} />
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
    >
      {IconContainer}
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-lg font-bold text-text-primary">{title}</Text>
          {badge && (
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: theme.colors.accent.primary }}
            >
              <Text
                className="font-extrabold uppercase text-text-black"
                style={{ fontSize: theme.typography.fontSize.xs }}
              >
                {badge}
              </Text>
            </View>
          )}
        </View>
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
