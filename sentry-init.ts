import * as Sentry from '@sentry/react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';

import { isStaticExport } from '@/constants/platform';

let isInitialized = false;

export function initializeSentry() {
  if (isInitialized || isStaticExport) {
    return;
  }

  const appVersion = Application.nativeApplicationVersion ?? 'unknown';
  const phoneModel = Device.modelName ?? 'unknown';

  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? undefined,
    environment: __DEV__ ? 'development' : 'production',
    // Keep payloads intentionally minimal for privacy.
    sendDefaultPii: false,
    enableAutoSessionTracking: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 0,
    beforeBreadcrumb() {
      return null;
    },
    beforeSend(event) {
      // Keep only requested context fields.
      event.contexts = {
        app: {
          app_version: appVersion,
        },
        device: {
          model: phoneModel,
        },
      };

      // Remove optional data we do not want to send.
      delete event.user; // User identity context (id/email/username/ip when present)
      delete event.request; // HTTP request metadata (URL, headers, method, etc.)
      delete event.server_name; // Host/device name identifier
      delete event.fingerprint; // Custom grouping key for issue grouping behavior

      return event;
    },
  });

  isInitialized = true;
}

export function isSentryInitialized(): boolean {
  return isInitialized;
}
