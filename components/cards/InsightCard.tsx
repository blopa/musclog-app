import { LucideIcon, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { theme } from '../../theme';

export type InsightCardVariant = 'accent' | 'neutral' | 'warning' | 'success';

interface InsightCardProps {
  variant: InsightCardVariant;
  icon: LucideIcon;
  label: string;
  message: string;
  onDismiss?: () => void;
  expandable?: boolean;
  inlineLabel?: boolean;
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

export function InsightCard({
  variant,
  icon: Icon,
  label,
  message,
  onDismiss,
  expandable = true,
  inlineLabel = false,
}: InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { borderColor, backgroundColor, accentColor, iconTextColor } = variantStyles[variant];

  return (
    <Pressable
      onPress={expandable ? () => setIsExpanded(!isExpanded) : undefined}
      className="rounded-2xl border-2 p-4"
      style={{ borderColor, backgroundColor }}
    >
      <View className="flex-row items-start gap-3">
        <View
          className="h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: accentColor }}
        >
          <Icon size={16} color={iconTextColor} />
        </View>
        <View className="flex-1">
          {inlineLabel ? (
            <Text
              className="font-medium text-text-primary"
              numberOfLines={expandable && !isExpanded ? 2 : undefined}
              ellipsizeMode="tail"
            >
              <Text className="font-bold" style={{ color: accentColor }}>
                {label}{' '}
              </Text>
              {message}
            </Text>
          ) : (
            <>
              <View className="flex-row items-center justify-between">
                <Text
                  className="text-sm font-bold uppercase tracking-wider"
                  style={{ color: accentColor }}
                >
                  {label}
                </Text>
                {onDismiss ? (
                  <Pressable onPress={onDismiss} hitSlop={8}>
                    <X size={16} color={accentColor} />
                  </Pressable>
                ) : null}
              </View>
              <Text
                className="mt-0.5 font-medium text-text-primary"
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
