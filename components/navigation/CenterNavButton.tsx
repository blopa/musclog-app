import type { LucideIcon } from 'lucide-react-native';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { addOpacityToHex } from '@/theme';

/** Larger than any screen, so a held finger never counts as having left the button. */
const KEEP_TOUCH = { top: 4000, bottom: 4000, left: 4000, right: 4000 };

/**
 * react-native-web reports press-in 50 ms late and not at all for a shorter click, which would lose
 * the tap that sends a locked recording. Native Pressable reports it at once and ignores this.
 */
const WEB_PRESS_AT_ONCE = Platform.OS === 'web' ? { delayPressIn: 0 } : null;

type CenterNavButtonProps = {
  icon: LucideIcon;
  accessibilityLabel: string;
  active: boolean;
  onPress?: () => void;
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: () => void;
  /**
   * The held finger's moves. Passing it makes the button keep the touch however far the finger
   * goes, instead of releasing once it leaves the button.
   */
  onPressMove?: (event: GestureResponderEvent) => void;
  /** Moves the circle with a held finger. */
  offsetY?: number;
  /** On the web, a handler here keeps a long touch from opening the browser's context menu. */
  onLongPress?: () => void;
  /** Where the button sits in the bar's row; the voice overlay places its hint above it. */
  onLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * The round accent button in the middle of the bottom bar. The camera and the microphone both
 * render through it, so the circle, its size on a narrow screen and the active fill live here once.
 */
export function CenterNavButton({
  icon: Icon,
  accessibilityLabel,
  active,
  onPress,
  onPressIn,
  onPressOut,
  onPressMove,
  offsetY = 0,
  onLongPress,
  onLayout,
}: CenterNavButtonProps) {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 350;
  const followsFinger = onPressMove !== undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      // `select-none`: a held button must not select text on the web.
      className="z-10 select-none items-center justify-center gap-1"
      style={[
        isSmallScreen ? { width: '20%' } : { flex: 1 },
        // Without it a browser scrolls (or pulls to refresh) under a sliding finger.
        followsFinger && Platform.OS === 'web' ? ({ touchAction: 'none' } as object) : null,
      ]}
      pressRetentionOffset={followsFinger ? KEEP_TOUCH : undefined}
      cancelable={!followsFinger}
      onPressMove={onPressMove}
      {...(followsFinger ? WEB_PRESS_AT_ONCE : null)}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onLayout={onLayout}
    >
      <View
        className="items-center justify-center rounded-full"
        style={[
          isSmallScreen
            ? { width: screenWidth * 0.2, height: screenWidth * 0.2 }
            : { width: 80, height: 80 },
          {
            transform: [{ translateY: offsetY }],
            backgroundColor: active
              ? theme.colors.accent.primary
              : addOpacityToHex(theme.colors.accent.primary, 0.8),
          },
        ]}
      >
        <Icon
          size={isSmallScreen ? theme.iconSize.md : theme.iconSize.xl}
          color={theme.colors.background.secondaryDark}
          strokeWidth={theme.strokeWidth.medium}
        />
      </View>
    </Pressable>
  );
}
