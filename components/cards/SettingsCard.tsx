import { ChevronRight } from 'lucide-react-native';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useIsCramped } from '@/hooks/useIsCramped';
import { useMeasuredWidth } from '@/hooks/useMeasuredWidth';
import { useTheme } from '@/hooks/useTheme';
import { layoutIconRow } from '@/utils/fitText';

/** The row's horizontal padding on each side: drawn from this, and the title's room is worked out from it. */
const ROW_PADDING_X = 16;
/** The smallest the title is drawn when even the row without its icon cannot hold its longest word. */
const MIN_TITLE_SIZE = 14;

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
  const cramped = useIsCramped();
  const { width: rowWidth, fontScale, onLayout } = useMeasuredWidth();
  const gap = theme.spacing.gap.md;
  // A long word (Dutch "Trainingsbestanden") must never be broken. The icon is decoration, so it
  // gives its room to the title (always while cramped), and only then does the title shrink a
  // little. The chevron stays: it is what says the row opens something.
  const { showIcon, fontSize } = layoutIconRow(
    [title],
    rowWidth === null ? null : rowWidth - 2 * ROW_PADDING_X,
    {
      fontSize: theme.typography.fontSize.base,
      minSize: MIN_TITLE_SIZE,
      iconRoom: theme.size['6'] + gap,
      trailingRoom: theme.iconSize.sm + gap,
      dropIcon: cramped,
      fontScale,
    }
  );
  // The icon is naked and neutral wherever it is drawn (docs/DESIGN.md, Components): callers pass the
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
      onLayout={onLayout}
      className="min-h-[52px] flex-row items-center py-3 active:opacity-80"
      style={{ paddingHorizontal: ROW_PADDING_X, gap }}
    >
      {showIcon ? (
        <View style={{ width: theme.size['6'], alignItems: 'center', justifyContent: 'center' }}>
          {neutralIcon}
        </View>
      ) : null}
      <View style={{ flex: 1, flexShrink: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize,
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
