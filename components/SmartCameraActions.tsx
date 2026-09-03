import { Images, Lightbulb, LightbulbOff, Search, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type SmartCameraRoundButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  onPress: () => void;
  /** Dims the button without disabling it — the AI context button uses this. */
  opacity?: number;
  /** `sm` for the top row, `md` for the bottom-right slot. */
  size?: 'sm' | 'md';
};

/**
 * The circular control on the camera chrome.
 *
 * It reads its own colours, so a caller that builds it outside the viewfinder's
 * `ThemeScope` still gets the pinned palette: the hook runs where the element is
 * rendered, not where it was constructed.
 */
export function SmartCameraRoundButton({
  children,
  disabled = false,
  onPress,
  opacity,
  size = 'sm',
}: SmartCameraRoundButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`${size === 'sm' ? 'h-10 w-10' : 'h-12 w-12'} items-center justify-center rounded-full`}
      style={{
        backgroundColor: theme.colors.background.neutralWash,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.background.ink10,
        ...(opacity === undefined ? {} : { opacity }),
      }}
    >
      {children}
    </Pressable>
  );
}

/** Opens the manual barcode entry sheet. Identical in both camera modals. */
export function SmartCameraTextSearchButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <SmartCameraRoundButton size="md" onPress={onPress}>
      <Search size={theme.iconSize.lg} color={theme.colors.text.primary} />
    </SmartCameraRoundButton>
  );
}

/** Stands in for the live preview when the camera is not mounted. */
export function SmartCameraPlaceholder() {
  const theme = useTheme();

  return <View style={{ backgroundColor: theme.colors.background.tint, flex: 1 }} />;
}

type SmartCameraTopActionsProps = {
  onClose: () => void;
  flashEnabled?: boolean;
  /**
   * Omit to hide the flash button entirely — the optical receiver drops it on web and on any
   * device whose camera has no torch, leaving close on its own.
   */
  onFlashToggle?: () => void;
  /** True while a capture/pick or the processing overlay runs; dims and disables everything but close. */
  controlsLocked?: boolean;
};

/** Close and flash, pinned above the frame's scrim (z-20) so they stay undimmed. */
export function SmartCameraTopActions({
  controlsLocked = false,
  flashEnabled = false,
  onClose,
  onFlashToggle,
}: SmartCameraTopActionsProps) {
  const theme = useTheme();

  return (
    <View className="relative z-20 flex-row items-center justify-between px-4 pb-2 pt-4">
      {/* Close stays enabled while an action runs — if a native capture hangs, the
          user must still be able to leave the modal. */}
      <SmartCameraRoundButton onPress={onClose}>
        <X size={theme.iconSize.lg} color={theme.colors.text.primary} />
      </SmartCameraRoundButton>

      {onFlashToggle ? (
        <SmartCameraRoundButton
          onPress={onFlashToggle}
          disabled={controlsLocked}
          opacity={controlsLocked ? theme.colors.opacity.medium : 1}
        >
          {flashEnabled ? (
            <Lightbulb size={theme.iconSize.lg} color={theme.colors.text.primary} />
          ) : (
            <LightbulbOff size={theme.iconSize.lg} color={theme.colors.text.primary} />
          )}
        </SmartCameraRoundButton>
      ) : null}
    </View>
  );
}

type SmartCameraBottomActionsProps = {
  /** Already wrapped in the shell's one-action-at-a-time latch. */
  onGalleryPress: () => void;
  /**
   * Already wrapped in the shell's latch. Omit to hide the shutter button entirely — barcode
   * scanning reads the live preview, so it has nothing to capture manually and leaves the slot
   * empty (the placeholder keeps the gallery and bottom-right buttons on their usual edges).
   */
  onShutterPress?: () => void;
  /** Slot for the bottom-right control button (text search, AI context, or empty). */
  bottomRightControl?: ReactNode;
  controlsLocked: boolean;
};

/** Gallery picker, shutter, and the owner's bottom-right slot, in one evenly spread row. */
export function SmartCameraBottomActions({
  bottomRightControl,
  controlsLocked,
  onGalleryPress,
  onShutterPress,
}: SmartCameraBottomActionsProps) {
  const theme = useTheme();

  return (
    <View className="flex-row items-center justify-between px-2">
      <Pressable
        className="h-12 w-12 items-center justify-center rounded-lg active:scale-95"
        style={[
          {
            backgroundColor: theme.colors.background.neutralWash,
            borderWidth: theme.borderWidth.thin,
            borderColor: theme.colors.background.ink20,
          },
          { opacity: controlsLocked ? theme.colors.opacity.medium : 1 },
        ]}
        disabled={controlsLocked}
        onPress={onGalleryPress}
      >
        <Images size={theme.iconSize.lg} color={theme.colors.text.primary} />
      </Pressable>

      {/* Shutter Button. The owner decides whether there is one: barcode scanning reads
          the live preview and passes no handler, leaving the slot empty. */}
      {onShutterPress ? (
        <Pressable
          onPress={onShutterPress}
          disabled={controlsLocked}
          className="h-20 w-20 items-center justify-center rounded-full active:scale-95"
          style={{
            borderWidth: theme.borderWidth.thick,
            borderColor: theme.colors.text.primary,
            opacity: controlsLocked ? theme.colors.opacity.strong : 1,
          }}
        >
          <View
            className="absolute inset-0 rounded-full"
            style={{
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.background.scrim20,
            }}
          />
          <View
            className="h-16 w-16 rounded-full bg-white"
            style={{ backgroundColor: theme.colors.text.primary }}
          />
        </Pressable>
      ) : (
        <View className="h-20 w-20" />
      )}

      {/* Bottom-right control slot */}
      {bottomRightControl ?? <View className="h-12 w-12" />}
    </View>
  );
}
