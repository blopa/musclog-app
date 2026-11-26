import { CameraOff } from 'lucide-react-native';
import { Component, Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';
import { handleError } from '@/utils/handleError';

type CameraErrorBoundaryProps = {
  children: ReactNode;
  /** Receives the error once; must not throw (any throw is swallowed). */
  onError: (error: unknown) => void;
  /** What fills the camera area instead; `retry` remounts the camera. */
  fallback: (retry: () => void) => ReactNode;
};

type CameraErrorBoundaryState = { failed: boolean; attempt: number };

/**
 * Keeps a camera failure inside the camera area. Without it a camera error reached the app's root
 * boundary, and a device that could not start (vision-camera's `device/invalid-device`) took the
 * whole app down (docs/FIXES.md).
 *
 * Never touches the error object: vision-camera's `CameraError` has a getter-only `cause`, and a
 * boundary that assigned to it threw from `componentDidCatch`, which React treats as fatal.
 */
export class CameraErrorBoundary extends Component<
  CameraErrorBoundaryProps,
  CameraErrorBoundaryState
> {
  state: CameraErrorBoundaryState = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<CameraErrorBoundaryState> {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    try {
      this.props.onError(error);
    } catch {
      // Reporting must never turn a contained camera failure into an app crash.
    }
  }

  private retry = (): void => {
    this.setState((state) => ({ failed: false, attempt: state.attempt + 1 }));
  };

  render(): ReactNode {
    if (this.state.failed) {
      return this.props.fallback(this.retry);
    }

    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}

/** Sends a camera failure to Sentry without a snackbar: the camera area already says it. */
export function reportCameraError(error: unknown, context: string): void {
  handleError(error, context, { showSnackbar: false }).catch(() => {
    // Nothing more to do: reporting is best effort.
  });
}

const BODY_KEYS = {
  plain: 'camera.unavailable.body',
  withGallery: 'camera.unavailable.bodyWithGallery',
} as const;

type CameraUnavailableProps = {
  /** `withGallery` when the screen also offers picking a photo from the gallery. */
  body: keyof typeof BODY_KEYS;
  /** Shown as Try again; leave out when trying again cannot help (no camera at all). */
  onRetry?: () => void;
};

/** What the camera area shows when the camera cannot run. */
export function CameraUnavailable({ body, onRetry }: CameraUnavailableProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View className="flex-1 items-center justify-center gap-3 p-6" accessibilityRole="alert">
      <CameraOff size={theme.iconSize.xl} color={theme.colors.text.secondary} />
      <Text className="text-center text-lg font-semibold text-text-primary">
        {t('camera.unavailable.title')}
      </Text>
      <Text className="text-center text-sm text-text-secondary">{t(BODY_KEYS[body])}</Text>
      {onRetry ? (
        <Button
          label={t('camera.unavailable.retry')}
          onPress={onRetry}
          variant="outline"
          // Button defaults to alignSelf: 'flex-start', which beats the parent's items-center.
          style={{ alignSelf: 'center' }}
        />
      ) : null}
    </View>
  );
}
