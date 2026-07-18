import { LinearGradient } from 'expo-linear-gradient';
import type { TFunction } from 'i18next';
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
import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraProcessingIndicator } from '@/components/CameraProcessingIndicator';
import { useTheme } from '@/hooks/useTheme';

import { FullScreenModal } from './FullScreenModal';
import type { CameraMode } from './SmartCameraModal';

const SMALL_SCREEN_HEIGHT = 700;

const getCameraInstructionText = (cameraMode: CameraMode, t: TFunction): string => {
  switch (cameraMode) {
    case 'ai-meal-photo':
      return t('food.aiCamera.mealInstruction');
    case 'ai-label-scan':
      return t('food.aiCamera.labelInstruction');
    case 'barcode-scan':
      return t('food.aiCamera.barcodeAutoInstruction');
    default:
      return '';
  }
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
  /** Awaited by the shell, which locks every control except close while either runs. */
  onShutterPress: () => void | Promise<void>;
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
  const { height: screenHeight } = useWindowDimensions();
  const isSmallScreen = screenHeight < SMALL_SCREEN_HEIGHT;
  const cameraMaxHeight = screenHeight * (isSmallScreen ? 0.48 : 0.6);

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
            {/* Opaque capture state. pointerEvents="none" so the close button
                (kept enabled while an action runs) stays tappable. */}
            {isActionRunning ? (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: theme.colors.text.black,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <ActivityIndicator size="large" color={theme.colors.text.white} />
              </View>
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
            <View
              className="relative w-full rounded-2xl"
              style={{
                aspectRatio: theme.aspectRatio.portrait,
                maxHeight: cameraMaxHeight,
                borderWidth: theme.borderWidth.thin,
                borderColor: theme.colors.background.white20,
                overflow: 'visible',
              }}
            >
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

              {/* Center Line */}
              <View
                className="absolute left-0 right-0"
                style={{
                  top: '50%',
                  height: theme.borderWidth.thin,
                  backgroundColor: theme.colors.accent.primary40,
                }}
              />
            </View>

            {/* Instruction Text */}
            <Text
              className="text-center text-sm font-medium drop-shadow-md"
              style={{ color: theme.colors.overlay.white90, marginTop: isSmallScreen ? 8 : 24 }}
            >
              {getCameraInstructionText(cameraMode, t)}
            </Text>
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

              {/* Shutter Button */}
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
