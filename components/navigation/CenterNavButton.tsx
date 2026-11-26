import type { LucideIcon } from 'lucide-react-native';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { addOpacityToHex } from '@/theme';

type CenterNavButtonProps = {
  icon: LucideIcon;
  accessibilityLabel: string;
  active: boolean;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
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
}: CenterNavButtonProps) {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 350;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="z-10 items-center justify-center gap-1"
      style={isSmallScreen ? { width: '20%' } : { flex: 1 }}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <View
        className="items-center justify-center rounded-full"
        style={[
          isSmallScreen
            ? { width: screenWidth * 0.2, height: screenWidth * 0.2 }
            : { width: 80, height: 80 },
          {
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
