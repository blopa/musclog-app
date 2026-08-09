import { LinearGradient } from 'expo-linear-gradient';
import { FileText, type LucideIcon, ScanBarcode, Sparkles } from 'lucide-react-native';
import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraProcessingIndicator } from '@/components/CameraProcessingIndicator';
import { SmartCameraBottomActions, SmartCameraTopActions } from '@/components/SmartCameraActions';
import { SMALL_SCREEN_HEIGHT, SmartCameraFrame } from '@/components/SmartCameraFrame';
import { useTheme } from '@/hooks/useTheme';

import { FullScreenModal } from './FullScreenModal';
import type { CameraMode } from './SmartCameraModal';

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

            <SmartCameraFrame
              variant={cameraMode === 'barcode-scan' ? 'barcode' : 'portrait'}
              isCapturing={isActionRunning}
            />

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
            {noticeSlot ? <View className="mb-4">{noticeSlot}</View> : null}

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

            <SmartCameraBottomActions
              onGalleryPress={() => runExclusive(onGalleryPress)}
              onShutterPress={onShutterPress ? () => runExclusive(onShutterPress) : undefined}
              bottomRightControl={bottomRightControl}
              controlsLocked={controlsLocked}
            />
          </View>
        </SafeAreaView>
      </View>
      {children}
    </FullScreenModal>
  );
}
