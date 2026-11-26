import { Component, type ErrorInfo, type ReactNode } from 'react';

import { ErrorFallbackScreen } from '@/components/ErrorFallbackScreen';
import { captureException } from '@/utils/sentry';

type AppErrorBoundaryProps = { children: ReactNode };

type AppErrorBoundaryState = { error: unknown; hasError: boolean };

/**
 * The app's root error boundary: a render error shows `ErrorFallbackScreen` and is reported.
 *
 * Deliberately not `Sentry.ErrorBoundary`. Its `componentDidCatch` assigns `error.cause`, and
 * vision-camera's `CameraError` has a getter-only `cause`, so the boundary itself threw, nothing
 * caught it and React Native closed the app (docs/FIXES.md). This one never writes to the error
 * and never lets reporting throw.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, hasError: false };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { error, hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    try {
      captureException(error, {
        captureContext: {
          level: 'fatal',
          tags: { context: 'app.errorBoundary' },
          extra: { componentStack: info.componentStack ?? null },
        },
      }).catch(() => {
        // Reporting is best effort; the fallback is already on screen.
      });
    } catch {
      // Same: never let the report turn a caught error into a crash.
    }
  }

  private resetError = (): void => {
    this.setState({ error: null, hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorFallbackScreen error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}
