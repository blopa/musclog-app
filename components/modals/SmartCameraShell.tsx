import { LinearGradient } from 'expo-linear-gradient';
import {
  FileText,
  Images,
  Lightbulb,
  LightbulbOff,
  type LucideIcon,
  ScanBarcode,
  Sparkles,
  X,
} from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraProcessingIndicator } from '@/components/CameraProcessingIndicator';
import { useTheme } from '@/hooks/useTheme';
import { addOpacityToHex } from '@/theme';

import { FullScreenModal } from './FullScreenModal';
import type { CameraMode } from './SmartCameraModal';

const SMALL_SCREEN_HEIGHT = 700;
/** Height of the glow band that travels with the barcode scan line, capped to a share of the frame. */
const SCAN_LINE_GLOW_HEIGHT = 56;
const SCAN_LINE_GLOW_FRAME_SHARE = 0.4;
/** Duration of a single top-to-bottom sweep; the animation reverses to sweep back up. */
const SCAN_LINE_SWEEP_MS = 1800;

/**
 * Fraction of the screen height the capture frame may occupy. Barcode scanning uses a short,
 * barcode-shaped frame; the AI modes keep a taller one that fits a plate or a nutrition label.
 * The AI caps leave room for the heading and hint — the frame does not shrink (RN defaults
 * `flexShrink` to 0), so a cap that is too generous pushes them off screen instead of squeezing.
 */
const getFrameMaxHeightRatio = (cameraMode: CameraMode, isSmallScreen: boolean): number => {
  if (cameraMode === 'barcode-scan') {
    return isSmallScreen ? 0.15 : 0.2;
  }

  return isSmallScreen ? 0.5 : 0.55;
};

/** Heading above the frame plus the hint below it, one entry per capture mode. */
const CAMERA_MODE_COPY: Record<
  CameraMode,
  { titleKey: string; subtitleKey: string; hintKey: string }
> = {
  'ai-label-scan': {
    titleKey: 'food.aiCamera.labelTitle',
    subtitleKey: 'food.aiCamera.labelInstruction',
    hintKey: 'food.aiCamera.labelHint',
  },
  'ai-meal-photo': {
    titleKey: 'food.aiCamera.mealTitle',
    subtitleKey: 'food.aiCamera.mealInstruction',
    hintKey: 'food.aiCamera.mealHint',
  },
  'barcode-scan': {
    titleKey: 'food.aiCamera.barcodeTitle',
    subtitleKey: 'food.aiCamera.barcodeAutoInstruction',
    hintKey: 'food.aiCamera.barcodeHint',
  },
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

type ModePickerTabProps = {
  mode: CameraMode;
  activeMode: CameraMode;
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  isSmallScreen: boolean;
  onSelect: (mode: CameraMode) => void;
};

function ModePickerTab({
  mode,
  activeMode,
  icon: Icon,
  label,
  disabled,
  isSmallScreen,
  onSelect,
}: ModePickerTabProps) {
  const theme = useTheme();
  const isActive = mode === activeMode;
  const color = isActive ? theme.colors.text.white : theme.colors.text.secondary;

  return (
    <Pressable
      onPress={() => onSelect(mode)}
      disabled={disabled}
      className="flex-1 rounded-xl px-2"
      style={[
        {
          overflow: 'hidden',
          paddingVertical: isSmallScreen ? 8 : 10,
          opacity: disabled ? theme.colors.opacity.medium : 1,
        },
        isActive ? { backgroundColor: 'transparent' } : {},
      ]}
    >
      {isActive ? (
        <LinearGradient
          colors={theme.colors.gradients.cta}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: theme.borderRadius.md,
            overflow: 'hidden',
          }}
        />
      ) : null}
      <View className="flex-row items-center justify-center gap-1.5">
        <Icon size={theme.iconSize.md} color={color} />
        {!isSmallScreen ? (
          <Text
            className="font-bold uppercase tracking-wide"
            style={{ fontSize: theme.typography.fontSize.xs, color }}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

type SmartCameraShellProps = {
  visible: boolean;
  onClose: () => void;
  permissionGranted: boolean | null;
  onRequestPermission: () => void;
  children?: ReactNode;
  /** The live camera view (or dark placeholder) rendered in the background. */
  cameraSlot: ReactNode;
  /** Shows the processing overlay when true. */
  isLoading: boolean;
  cameraMode: CameraMode;
  flashEnabled: boolean;
  onFlashToggle: () => void;
  /** Awaited by the shell, which locks every control except close while either runs. */
  onGalleryPress: () => void | Promise<void>;
  /**
   * Awaited by the shell, which locks every control except close while either runs. Omit to hide
   * the shutter button entirely — barcode scanning reads the live preview, so it has nothing to
   * capture manually and leaves the slot empty.
   */
  onShutterPress?: () => void | Promise<void>;
  /** Slot for the bottom-right control button (text search, AI context, or empty). */
  bottomRightControl?: ReactNode;
  /** When true, renders the three-tab mode picker. */
  showModePicker?: boolean;
  isAiEnabled?: boolean;
  isAIVisionEnabled?: boolean;
  onModeChange?: (mode: CameraMode) => void;
};

export function SmartCameraShell({
  visible,
  onClose,
  permissionGranted,
  onRequestPermission,
  children,
  cameraSlot,
  isLoading,
  cameraMode,
  flashEnabled,
  onFlashToggle,
  onGalleryPress,
  onShutterPress,
  bottomRightControl,
  showModePicker = false,
  isAiEnabled = false,
  isAIVisionEnabled = false,
  onModeChange,
}: SmartCameraShellProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenHeight < SMALL_SCREEN_HEIGHT;
  // The frame is roughly centered, so one screen's worth in every direction always reaches the edge.
  const scrimOverscan = Math.max(screenHeight, screenWidth);
  const isBarcodeScan = cameraMode === 'barcode-scan';
  const modeCopy = CAMERA_MODE_COPY[cameraMode];
  const cameraMaxHeight = screenHeight * getFrameMaxHeightRatio(cameraMode, isSmallScreen);
  const [frameHeight, setFrameHeight] = useState(0);

  // One owner-provided async action (shutter capture or gallery pick) runs at a time: without
  // this latch, taps landing while the (slow) native capture is still in flight each fire a
  // full capture+crop flow, so the crop tool ends up presented N times in a row. The ref
  // catches taps that land before the disabling re-render commits.
  const [isActionRunning, setIsActionRunning] = useState(false);
  const actionRunningRef = useRef(false);

  const runExclusive = async (action: () => void | Promise<void>) => {
    if (actionRunningRef.current) {
      return;
    }

    actionRunningRef.current = true;
    setIsActionRunning(true);
    try {
      await action();
    } finally {
      actionRunningRef.current = false;
      setIsActionRunning(false);
    }
  };

  const controlsLocked = isLoading || isActionRunning;
  const lockedControlStyle = { opacity: controlsLocked ? theme.colors.opacity.medium : 1 };

  const handleModeSelect = (mode: CameraMode) => onModeChange?.(mode);

  if (permissionGranted === null) {
    return (
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('camera.title')}
        scrollable={false}
        showHeader={false}
      >
        <View
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: theme.colors.text.black }}
        >
          <Text style={{ color: theme.colors.text.white }}>
            {t('food.aiCamera.requestingPermission')}
          </Text>
        </View>
      </FullScreenModal>
    );
  }

  if (!permissionGranted) {
    return (
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('camera.title')}
        scrollable={false}
        showHeader={false}
      >
        <View
          className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: theme.colors.text.black }}
        >
          <Text className="mb-4 text-center text-lg" style={{ color: theme.colors.text.white }}>
            {t('food.aiCamera.permissionRequired')}
          </Text>
          <Pressable
            onPress={onRequestPermission}
            className="rounded-xl bg-accent-primary px-6 py-3"
          >
            <Text className="font-semibold" style={{ color: theme.colors.text.black }}>
              {t('food.aiCamera.grantPermission')}
            </Text>
          </Pressable>
        </View>
      </FullScreenModal>
    );
  }

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('camera.title')}
      scrollable={false}
      showHeader={false}
    >
      <View className="flex-1" style={{ backgroundColor: theme.colors.text.black }}>
        <SystemBars style="light" />
        <SafeAreaView className="flex-1" edges={['top']}>
          {/* Camera Background */}
          <View className="absolute inset-0">
            {cameraSlot}
            {/* Gradient Overlay */}
            <LinearGradient
              colors={theme.colors.gradients.cameraOverlay}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
            {/* Opaque capture state. The spinner is rendered in the camera frame below so it
                stays centered in the capture area on every screen size. */}
            {isActionRunning ? (
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.text.black }]}
              />
            ) : null}
          </View>

          {/* Header */}
          <View className="relative z-20 flex-row items-center justify-between px-4 pb-2 pt-4">
            {/* Close stays enabled while an action runs — if a native capture hangs, the
                user must still be able to leave the modal. */}
            <Pressable
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{
                backgroundColor: theme.colors.background.darkGray,
                borderWidth: theme.borderWidth.thin,
                borderColor: theme.colors.background.white10,
              }}
            >
              <X size={theme.iconSize.lg} color={theme.colors.text.primary} />
            </Pressable>

            <Pressable
              onPress={onFlashToggle}
              disabled={controlsLocked}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={[
                {
                  backgroundColor: theme.colors.background.darkGray,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: theme.colors.background.white10,
                },
                lockedControlStyle,
              ]}
            >
              {flashEnabled ? (
                <Lightbulb size={theme.iconSize.lg} color={theme.colors.text.primary} />
              ) : (
                <LightbulbOff size={theme.iconSize.lg} color={theme.colors.text.primary} />
              )}
            </Pressable>
          </View>

          {/* Loading Overlay */}
          {isLoading ? (
            <View
              className="absolute inset-0 z-30"
              style={{ backgroundColor: theme.colors.overlay.black90 }}
            >
              <CameraProcessingIndicator cameraMode={cameraMode} />
            </View>
          ) : null}

          {/* Main Content - Camera Frame */}
          <View className="relative z-10 flex-1 items-center justify-center px-6">
            {/* Heading. zIndex lifts it over the frame's scrim, which spills across the screen. */}
            <View
              className="items-center"
              style={{ marginBottom: isSmallScreen ? 16 : 24, zIndex: 1 }}
            >
              <Text
                className="text-center text-2xl font-bold drop-shadow-md"
                style={{ color: theme.colors.text.white }}
              >
                {t(modeCopy.titleKey)}
              </Text>
              <Text
                className="mt-2 text-center text-sm font-medium drop-shadow-md"
                style={{ color: theme.colors.overlay.white70 }}
              >
                {t(modeCopy.subtitleKey)}
              </Text>
            </View>

            <View
              className="relative w-full rounded-2xl"
              onLayout={(event) => setFrameHeight(event.nativeEvent.layout.height)}
              style={{
                aspectRatio: isBarcodeScan
                  ? theme.aspectRatio.landscape
                  : theme.aspectRatio.portrait,
                maxHeight: cameraMaxHeight,
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

              {/* Sweeping scan line, barcode mode only — the AI modes have no center line */}
              {isBarcodeScan ? (
                <ScanLine active={!isActionRunning} frameHeight={frameHeight} />
              ) : null}

              {isActionRunning ? (
                <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
                  <ActivityIndicator
                    size="large"
                    color={theme.colors.text.white}
                    style={{ transform: [{ scale: 1.6 }] }}
                  />
                </View>
              ) : null}
            </View>

            {/* Hint. Same zIndex reason as the heading above. */}
            <View
              className="flex-row items-center justify-center gap-2"
              style={{ marginTop: isSmallScreen ? 12 : 20, zIndex: 1 }}
            >
              <Sparkles size={theme.iconSize.md} color={theme.colors.overlay.white70} />
              <Text
                className="text-center text-sm font-medium drop-shadow-md"
                style={{ color: theme.colors.overlay.white70 }}
              >
                {t(modeCopy.hintKey)}
              </Text>
            </View>
          </View>

          {/* Bottom Controls */}
          <View
            className="relative z-20 px-4 pt-4"
            style={{ paddingBottom: isSmallScreen ? 16 : 40 }}
          >
            {/* Mode Selector */}
            {showModePicker && isAiEnabled ? (
              <View
                className={isSmallScreen ? 'mb-3 w-full items-center' : 'mb-6 w-full items-center'}
              >
                <View
                  className="w-full max-w-sm flex-row items-stretch justify-between rounded-2xl p-1.5"
                  style={{
                    backgroundColor: theme.colors.background.darkGray90,
                    borderWidth: theme.borderWidth.thin,
                    borderColor: theme.colors.background.white10,
                  }}
                >
                  <ModePickerTab
                    mode="barcode-scan"
                    activeMode={cameraMode}
                    icon={ScanBarcode}
                    label={t('food.aiCamera.modes.barcodeScan')}
                    disabled={controlsLocked}
                    isSmallScreen={isSmallScreen}
                    onSelect={handleModeSelect}
                  />

                  <ModePickerTab
                    mode="ai-label-scan"
                    activeMode={cameraMode}
                    icon={FileText}
                    label={t('food.aiCamera.modes.labelScan')}
                    disabled={controlsLocked}
                    isSmallScreen={isSmallScreen}
                    onSelect={handleModeSelect}
                  />

                  {isAIVisionEnabled ? (
                    <ModePickerTab
                      mode="ai-meal-photo"
                      activeMode={cameraMode}
                      icon={Sparkles}
                      label={t('food.aiCamera.modes.mealPhoto')}
                      disabled={controlsLocked}
                      isSmallScreen={isSmallScreen}
                      onSelect={handleModeSelect}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Camera Controls */}
            <View className="flex-row items-center justify-between px-2">
              <Pressable
                className="h-12 w-12 items-center justify-center rounded-lg active:scale-95"
                style={[
                  {
                    backgroundColor: theme.colors.background.darkGray50,
                    borderWidth: theme.borderWidth.thin,
                    borderColor: theme.colors.background.white20,
                  },
                  lockedControlStyle,
                ]}
                disabled={controlsLocked}
                onPress={() => runExclusive(onGalleryPress)}
              >
                <Images size={theme.iconSize.lg} color={theme.colors.text.primary} />
              </Pressable>

              {/* Shutter Button. The owner decides whether there is one: barcode scanning reads
                  the live preview and passes no handler, leaving the slot empty. */}
              {onShutterPress ? (
                <Pressable
                  onPress={() => runExclusive(onShutterPress)}
                  disabled={controlsLocked}
                  className="h-20 w-20 items-center justify-center rounded-full active:scale-95"
                  style={{
                    borderWidth: theme.borderWidth.thick,
                    borderColor: theme.colors.text.white,
                    opacity: controlsLocked ? theme.colors.opacity.strong : 1,
                  }}
                >
                  <View
                    className="absolute inset-0 rounded-full"
                    style={{
                      borderWidth: theme.borderWidth.thin,
                      borderColor: theme.colors.background.black20,
                    }}
                  />
                  <View
                    className="h-16 w-16 rounded-full bg-white"
                    style={{ backgroundColor: theme.colors.text.white }}
                  />
                </Pressable>
              ) : (
                <View className="h-20 w-20" />
              )}

              {/* Bottom-right control slot */}
              {bottomRightControl ?? <View className="h-12 w-12" />}
            </View>
          </View>
        </SafeAreaView>
      </View>
      {children}
    </FullScreenModal>
  );
}
