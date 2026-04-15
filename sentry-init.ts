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
    beforeSend(event) {
      const minimalEvent = {
        ...event,
        // Keep only the requested metadata.
        contexts: {
          app: {
            app_version: appVersion,
          },
          device: {
            model: phoneModel,
          },
        },
      };

      // Drop non-required fields to keep payload minimal.
      delete minimalEvent.user;
      delete minimalEvent.request;
      delete minimalEvent.tags;
      delete minimalEvent.extra;
      delete minimalEvent.breadcrumbs;
      delete minimalEvent.modules;
      delete minimalEvent.server_name;
      delete minimalEvent.release;
      delete minimalEvent.environment;
      delete minimalEvent.sdk;
      delete minimalEvent.debug_meta;
      delete minimalEvent.transaction;
      delete minimalEvent.fingerprint;
      delete minimalEvent.platform;
      delete minimalEvent.dist;

      return minimalEvent;
    },
  });

  isInitialized = true;
}

export function isSentryInitialized(): boolean {
  return isInitialized;
}
