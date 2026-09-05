import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraProcessingIndicator } from '@/components/CameraProcessingIndicator';
import { SmartCameraBottomActions, SmartCameraTopActions } from '@/components/SmartCameraActions';
import { SMALL_SCREEN_HEIGHT, SmartCameraFrame } from '@/components/SmartCameraFrame';
import { SmartCameraModePicker } from '@/components/SmartCameraModePicker';
import type { CameraMode } from '@/constants/camera';
import { ThemeScope } from '@/context/ThemeContext';
import { useTheme } from '@/hooks/useTheme';

import { FullScreenModal } from './FullScreenModal';

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
  /**
   * A card shown above the bottom controls — currently the "that is an optical transfer, not a
   * barcode" offer. In flow rather than absolutely positioned on purpose: floated over the feed it
   * would land on the shutter, and this is a slot for things the user is meant to act on.
   */
  noticeSlot?: ReactNode;
  /** When true, renders the three-tab mode picker. */
  showModePicker?: boolean;
  isAiEnabled?: boolean;
  isAIVisionEnabled?: boolean;
  onModeChange?: (mode: CameraMode) => void;
};

function SmartCameraShellBody({
  onClose,
  permissionGranted,
  onRequestPermission,
  cameraSlot,
  isLoading,
  cameraMode,
  flashEnabled,
  onFlashToggle,
  onGalleryPress,
  onShutterPress,
  bottomRightControl,
  noticeSlot,
  showModePicker = false,
  isAiEnabled = false,
  isAIVisionEnabled = false,
  onModeChange,
}: SmartCameraShellProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const isSmallScreen = screenHeight < SMALL_SCREEN_HEIGHT;
  const modeCopy = CAMERA_MODE_COPY[cameraMode];

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

  if (permissionGranted === null) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.colors.background.primary }}
      >
        <Text style={{ color: theme.colors.text.alwaysWhite }}>
          {t('food.aiCamera.requestingPermission')}
        </Text>
      </View>
    );
  }

  if (!permissionGranted) {
    return (
      <View
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: theme.colors.background.primary }}
      >
        <Text className="mb-4 text-center text-lg" style={{ color: theme.colors.text.alwaysWhite }}>
          {t('food.aiCamera.permissionRequired')}
        </Text>
        <Pressable onPress={onRequestPermission} className="rounded-xl bg-accent-primary px-6 py-3">
          <Text className="font-semibold" style={{ color: theme.colors.text.onAccent }}>
            {t('food.aiCamera.grantPermission')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background.primary }}>
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
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: theme.colors.background.primary },
              ]}
            />
          ) : null}
        </View>

        <SmartCameraTopActions
          onClose={onClose}
          flashEnabled={flashEnabled}
          onFlashToggle={onFlashToggle}
          controlsLocked={controlsLocked}
        />

        {/* Loading Overlay */}
        {isLoading ? (
          <View
            className="absolute inset-0 z-30"
            style={{ backgroundColor: theme.colors.overlay.scrim90 }}
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
              style={{ color: theme.colors.text.alwaysWhite }}
            >
              {t(modeCopy.titleKey)}
            </Text>
            <Text
              className="mt-2 text-center text-sm font-medium drop-shadow-md"
              style={{ color: theme.colors.overlay.alwaysWhite70 }}
            >
              {t(modeCopy.subtitleKey)}
            </Text>
          </View>

          <SmartCameraFrame
            variant={cameraMode === 'barcode-scan' ? 'barcode' : 'portrait'}
            isCapturing={isActionRunning}
          />

          {/* Hint. Same zIndex reason as the heading above. */}
          <View
            className="flex-row items-center justify-center gap-2"
            style={{ marginTop: isSmallScreen ? 12 : 20, zIndex: 1 }}
          >
            <Sparkles size={theme.iconSize.md} color={theme.colors.overlay.alwaysWhite70} />
            <Text
              className="text-center text-sm font-medium drop-shadow-md"
              style={{ color: theme.colors.overlay.alwaysWhite70 }}
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
          {noticeSlot ? <View className="mb-4">{noticeSlot}</View> : null}

          {/*
              Mode Selector. `onModeChange` is part of the condition, not defaulted to a no-op:
              a picker whose tabs do nothing is worse than no picker, and requiring the handler
              here is what lets `SmartCameraModePicker` take a non-optional one.
            */}
          {showModePicker && isAiEnabled && onModeChange ? (
            <SmartCameraModePicker
              cameraMode={cameraMode}
              disabled={controlsLocked}
              isAIVisionEnabled={isAIVisionEnabled}
              isSmallScreen={isSmallScreen}
              onModeChange={onModeChange}
            />
          ) : null}

          <SmartCameraBottomActions
            onGalleryPress={() => runExclusive(onGalleryPress)}
            onShutterPress={onShutterPress ? () => runExclusive(onShutterPress) : undefined}
            bottomRightControl={bottomRightControl}
            controlsLocked={controlsLocked}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

export function SmartCameraShell(props: SmartCameraShellProps) {
  const { t } = useTranslation();

  return (
    <FullScreenModal
      visible={props.visible}
      onClose={props.onClose}
      title={t('camera.title')}
      scrollable={false}
      showHeader={false}
    >
      {/*
        The viewfinder is a fixed dark surface whatever the user picked: its content is
        white-on-dark over a live preview. `ThemeScope` moves the context value and the
        NativeWind variables together, so everything below reads the pinned palette
        through the ordinary `useTheme()` — there is no second forced-theme mechanism.
      */}
      <ThemeScope themeId="kinetic-depth">
        <SmartCameraShellBody {...props} />
      </ThemeScope>
      {/*
        Nested detail modals are ordinary app surfaces, not camera chrome, so they sit
        outside the scope and follow the user's theme. They are also only mounted once
        the camera itself is, which is what the permission check preserves.
      */}
      {props.permissionGranted ? props.children : null}
    </FullScreenModal>
  );
}
