import { LucideIcon, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { theme } from '../../theme'; // TODO: figure out a way to use useTheme instead or dynamically use dark or light theme based on configuration

export type InsightCardVariant = 'accent' | 'neutral' | 'warning' | 'success';

export type InsightCardSize = 'xs' | 'sm' | 'md';

const sizeStyles: Record<
  InsightCardSize,
  { iconSize: number; fontSize: number; iconContainerSize: number }
> = {
  xs: { iconSize: 10, fontSize: theme.typography.fontSize.xxs, iconContainerSize: theme.size['5'] },
  sm: { iconSize: 12, fontSize: theme.typography.fontSize.xs, iconContainerSize: theme.size['6'] },
  md: { iconSize: 16, fontSize: theme.typography.fontSize.sm, iconContainerSize: theme.size['8'] },
};

interface InsightCardProps {
  variant: InsightCardVariant;
  icon: LucideIcon;
  label: string;
  message: string;
  onDismiss?: () => void;
  expandable?: boolean;
  inlineLabel?: boolean;
  size?: InsightCardSize;
}

const variantStyles: Record<
  InsightCardVariant,
  { borderColor: string; backgroundColor: string; accentColor: string; iconTextColor: string }
> = {
  accent: {
    borderColor: `${theme.colors.accent.primary}66`,
    backgroundColor: `${theme.colors.accent.primary}33`,
    accentColor: theme.colors.accent.primary,
    iconTextColor: theme.colors.text.black,
  },
  neutral: {
    borderColor: `${theme.colors.accent.tertiary}10`,
    backgroundColor: `${theme.colors.background.secondaryDark}60`,
    accentColor: theme.colors.accent.primary,
    iconTextColor: theme.colors.text.black,
  },
  warning: {
    borderColor: `${theme.colors.status.warning}66`,
    backgroundColor: `${theme.colors.background.card}95`,
    accentColor: theme.colors.status.warning,
    iconTextColor: theme.colors.text.white,
  },
  success: {
    borderColor: `${theme.colors.status.success}66`,
    backgroundColor: `${theme.colors.background.card}95`,
    accentColor: theme.colors.status.success,
    iconTextColor: theme.colors.text.black,
  },
};

export function InfoCard({
  variant,
  icon: Icon,
  label,
  message,
  onDismiss,
  expandable = true,
  inlineLabel = false,
  size = 'md',
}: InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { borderColor, backgroundColor, accentColor, iconTextColor } = variantStyles[variant];
  const { iconSize, fontSize, iconContainerSize } = sizeStyles[size];

  return (
    <Pressable
      onPress={expandable ? () => setIsExpanded(!isExpanded) : undefined}
      className="rounded-2xl border-2 p-4"
      style={{ borderColor, backgroundColor }}
    >
      <View className="flex-row items-start gap-3">
        <View
          className="items-center justify-center rounded-full"
          style={{
            backgroundColor: accentColor,
            width: iconContainerSize,
            height: iconContainerSize,
          }}
        >
          <Icon size={iconSize} color={iconTextColor} />
        </View>
        <View className="flex-1">
          {inlineLabel ? (
            <Text
              className="font-medium text-text-primary"
              style={{ fontSize }}
              numberOfLines={expandable && !isExpanded ? 2 : undefined}
              ellipsizeMode="tail"
            >
              <Text className="font-bold" style={{ color: accentColor, fontSize }}>
                {label}{' '}
              </Text>
              {message}
            </Text>
          ) : (
            <>
              <View className="flex-row items-center justify-between">
                <Text
                  className="font-bold uppercase tracking-wider"
                  style={{ color: accentColor, fontSize }}
                >
                  {label}
                </Text>
                {onDismiss ? (
                  <Pressable onPress={onDismiss} hitSlop={8}>
                    <X size={iconSize} color={accentColor} />
                  </Pressable>
                ) : null}
              </View>
              <Text
                className="mt-0.5 font-medium text-text-primary"
                style={{ fontSize }}
                numberOfLines={expandable && !isExpanded ? 1 : undefined}
                ellipsizeMode="tail"
              >
                {message}
              </Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}
