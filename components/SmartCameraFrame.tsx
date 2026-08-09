import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { addOpacityToHex, type Theme } from '@/theme';

/**
 * Below this screen height the frame gives back some of its share so the surrounding chrome still
 * fits. Exported because `SmartCameraShell` sizes its own margins off the same threshold — two
 * copies would let the frame and the copy around it disagree about which layout they are in.
 */
export const SMALL_SCREEN_HEIGHT = 700;

/**
 * `barcode` is a short, wide band with the glyph and the sweeping scan line; `portrait` is the
 * taller 4:5 window with a bare centre, used for a plate, a nutrition label, or the optical
 * transfer's QR stream.
 */
export type SmartCameraFrameVariant = 'barcode' | 'portrait';

/** Height of the glow band that travels with the barcode scan line, capped to a share of the frame. */
const SCAN_LINE_GLOW_HEIGHT = 56;
const SCAN_LINE_GLOW_FRAME_SHARE = 0.4;
/** Duration of a single top-to-bottom sweep; the animation reverses to sweep back up. */
const SCAN_LINE_SWEEP_MS = 1800;

/**
 * Size of the capture frame, which always spans the full content width — only the height differs
 * per variant.
 *
 * The barcode height is set directly instead of through an `aspectRatio` + `maxHeight` pair,
 * because clamping an aspect-ratio'd box makes Yoga re-derive a *narrower* width to preserve the
 * ratio — that is what used to leave the barcode frame far narrower than the AI modes'. The AI cap
 * never binds at portrait 4:5, and it leaves room for the heading and hint: the frame does not
 * shrink (RN defaults `flexShrink` to 0), so a cap that is too generous pushes them off screen
 * instead of squeezing.
 */
const getFrameSizeStyle = (
  variant: SmartCameraFrameVariant,
  isSmallScreen: boolean,
  screenHeight: number,
  theme: Theme
): ViewStyle => {
  if (variant === 'barcode') {
    return { height: screenHeight * (isSmallScreen ? 0.15 : 0.2) };
  }

  return {
    aspectRatio: theme.aspectRatio.portrait,
    maxHeight: screenHeight * (isSmallScreen ? 0.5 : 0.55),
  };
};

/**
 * Relative widths of the decorative barcode's bars. Fixed rather than random so the glyph is
 * stable across renders; each bar flexes, so the pattern scales with the frame.
 */
const BARCODE_GLYPH_BARS = [
  3, 1, 2, 1, 1, 4, 1, 2, 3, 1, 1, 2, 4, 1, 2, 1, 3, 1, 1, 2, 1, 4, 2, 1, 3, 1, 2, 2, 1, 1, 3, 1, 2,
  4, 1, 1, 2, 3, 1, 2,
];

/** Faded barcode drawn inside the frame, showing the user what to line up. Purely decorative. */
function BarcodeGlyph() {
  const theme = useTheme();

  return (
    <View
      pointerEvents="none"
      className="absolute inset-0 flex-row items-stretch justify-center gap-[2px] px-4 py-10"
      style={{ opacity: theme.colors.opacity.subtle }}
    >
      {BARCODE_GLYPH_BARS.map((barWidth, index) => (
        <View
          // Fixed decorative pattern — bars have no identity beyond their position.
          key={index}
          style={{ backgroundColor: theme.colors.text.white, flexGrow: barWidth, flexShrink: 1 }}
        />
      ))}
    </View>
  );
}

type FrameScrimProps = {
  /** How far past each frame edge the scrim reaches; must exceed the frame-to-screen-edge gap. */
  overscan: number;
};

/**
 * Dims the camera feed everywhere except inside the capture frame. Four rects anchored to the
 * frame's own edges with percentage offsets — no measurement, and no mask compositing — that spill
 * out to the screen edges through the frame's `overflow: visible`. They render inside the z-10
 * content layer, so the header and bottom controls (z-20) still paint above them undimmed.
 */
function FrameScrim({ overscan }: FrameScrimProps) {
  const theme = useTheme();
  const scrimStyle: ViewStyle = {
    backgroundColor: theme.colors.background.black40,
    position: 'absolute',
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Above */}
      <View
        style={[
          scrimStyle,
          { bottom: '100%', height: overscan, left: -overscan, right: -overscan },
        ]}
      />
      {/* Below */}
      <View
        style={[scrimStyle, { height: overscan, left: -overscan, right: -overscan, top: '100%' }]}
      />
      {/* Left */}
      <View style={[scrimStyle, { bottom: 0, right: '100%', top: 0, width: overscan }]} />
      {/* Right */}
      <View style={[scrimStyle, { bottom: 0, left: '100%', top: 0, width: overscan }]} />
    </View>
  );
}

type ScanLineProps = {
  /** Frame height in px, measured via onLayout — the sweep distance. 0 until the first layout. */
  frameHeight: number;
  /** Paused (and unmounted) while a capture runs, so it never competes with the spinner. */
  active: boolean;
};

/**
 * Barcode sweep: a glowing line travelling the frame top -> bottom -> top. It lives in its own
 * clipping container because the frame itself keeps `overflow: visible` for the corner markers,
 * which would otherwise let the glow band spill past the frame edges.
 */
function ScanLine({ active, frameHeight }: ScanLineProps) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  const isRunning = active && frameHeight > 0;
  const glowHeight = Math.min(SCAN_LINE_GLOW_HEIGHT, frameHeight * SCAN_LINE_GLOW_FRAME_SHARE);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: SCAN_LINE_SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );

    return () => cancelAnimation(progress);
  }, [isRunning, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * frameHeight - glowHeight / 2 }],
  }));

  if (!isRunning) {
    return null;
  }

  const transparentAccent = addOpacityToHex(theme.colors.accent.primary, theme.colors.opacity.zero);

  return (
    <View pointerEvents="none" className="absolute inset-0 overflow-hidden rounded-2xl">
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: glowHeight,
          },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={[transparentAccent, theme.colors.accent.primary40, transparentAccent]}
          style={StyleSheet.absoluteFill}
        />
        <View
          className="absolute left-0 right-0"
          style={{
            top: glowHeight / 2,
            height: theme.borderWidth.thin,
            backgroundColor: theme.colors.accent.primary,
          }}
        />
      </Animated.View>
    </View>
  );
}

type SmartCameraFrameProps = {
  variant: SmartCameraFrameVariant;
  /**
   * True while a capture or gallery pick runs: pauses the sweep and shows a spinner instead.
   * Cameras that never capture a still (the optical receiver just reads the live feed) omit it.
   */
  isCapturing?: boolean;
};

/**
 * The capture frame: an undimmed window onto the camera feed, with everything outside it scrimmed.
 * The `barcode` variant adds the decorative glyph and the sweeping scan line; `portrait` leaves the
 * window empty. The corner markers and the capture spinner are shared by both.
 *
 * `overflow: visible` is load-bearing — the corner markers sit outside the border and the scrim
 * spills from the frame's edges out to the nearest clipping ancestor, so nothing here may clip its
 * children. How far the dimming reaches is therefore the caller's choice: the smart camera lets it
 * run to the screen edges, while the optical receiver's `overflow-hidden` feed container stops it
 * at the camera area so the progress panel below stays bright.
 */
export function SmartCameraFrame({ isCapturing = false, variant }: SmartCameraFrameProps) {
  const theme = useTheme();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const [frameHeight, setFrameHeight] = useState(0);
  const isBarcodeScan = variant === 'barcode';
  const isSmallScreen = screenHeight < SMALL_SCREEN_HEIGHT;
  // The frame is roughly centered, so one screen's worth in every direction always reaches the edge.
  const scrimOverscan = Math.max(screenHeight, screenWidth);

  return (
    <View
      className="relative w-full rounded-2xl"
      onLayout={(event) => setFrameHeight(event.nativeEvent.layout.height)}
      style={{
        ...getFrameSizeStyle(variant, isSmallScreen, screenHeight, theme),
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.background.white20,
        overflow: 'visible',
      }}
    >
      {/* Dims the feed outside the frame. First child so everything below paints over it. */}
      <FrameScrim overscan={scrimOverscan} />

      {isBarcodeScan ? <BarcodeGlyph /> : null}

      {/* Corner Markers */}
      <View
        className="absolute -left-1 -top-1 h-8 w-8 rounded-tl-lg border-l-2 border-t-2"
        style={{ borderColor: theme.colors.accent.primary }}
      />
      <View
        className="absolute -right-1 -top-1 h-8 w-8 rounded-tr-lg border-r-2 border-t-2"
        style={{ borderColor: theme.colors.accent.primary }}
      />
      <View
        className="absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-lg border-b-2 border-l-2"
        style={{ borderColor: theme.colors.accent.primary }}
      />
      <View
        className="absolute -bottom-1 -right-1 h-8 w-8 rounded-br-lg border-b-2 border-r-2"
        style={{ borderColor: theme.colors.accent.primary }}
      />

      {/* Sweeping scan line, barcode variant only — the portrait window has no center line */}
      {isBarcodeScan ? <ScanLine active={!isCapturing} frameHeight={frameHeight} /> : null}

      {isCapturing ? (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={theme.colors.text.white}
            style={{ transform: [{ scale: 1.6 }] }}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * The frame as a free-floating overlay, for cameras that fill their container instead of laying the
 * frame out in a column the way `SmartCameraShell` does. `pointerEvents="none"` is required, not
 * cosmetic: the optical receiver puts tap-to-refocus on the feed underneath, and a frame that
 * swallowed touches would break the one thing the user can do about a stalled transfer.
 */
export function SmartCameraFrameOverlay(props: SmartCameraFrameProps) {
  return (
    <View pointerEvents="none" className="absolute inset-0 items-center justify-center px-6">
      <SmartCameraFrame {...props} />
    </View>
  );
}
