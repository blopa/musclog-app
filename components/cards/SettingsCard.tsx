import { ChevronRight } from 'lucide-react-native';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/**
 * A settings row: a naked icon, a title, one line of supporting text and a chevron. It draws no
 * surface of its own; stack rows inside a `ListGroup`, which supplies the rounded surface and the
 * hairlines between them.
 */
export function SettingsCard({
  icon,
  title,
  subtitle,
  onPress,
  rightIcon,
  titleColor,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  rightIcon?: ReactNode;
  titleColor?: string;
}) {
  const theme = useTheme();
  // The icon is naked and neutral wherever it is drawn (DESIGN.md, Components): callers pass the
  // glyph, this row decides its size and color.
  const neutralIcon = isValidElement(icon)
    ? cloneElement(icon as ReactElement<{ size?: number; color?: string }>, {
        size: theme.iconSize.md,
        color: theme.colors.text.secondary,
      })
    : icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      onPress={onPress}
      android_ripple={{ color: theme.colors.background.ink10 }}
      className="min-h-[52px] flex-row items-center gap-3 px-4 py-3 active:opacity-80"
    >
      <View style={{ width: theme.size['6'], alignItems: 'center', justifyContent: 'center' }}>
        {neutralIcon}
      </View>
      <View style={{ flex: 1, flexShrink: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: theme.typography.fontSize.base,
            fontWeight: theme.typography.fontWeight.semibold,
            color: titleColor || theme.colors.text.primary,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.secondary,
          }}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
      {rightIcon === undefined ? (
        <ChevronRight size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
      ) : (
        rightIcon
      )}
    </Pressable>
  );
}
