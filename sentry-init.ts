import * as Sentry from '@sentry/react-native';

let isInitialized = false;

export function initializeSentry() {
  if (isInitialized) {
    return;
  }

  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? undefined,
    environment: __DEV__ ? 'development' : 'production',
    sendDefaultPii: true,
    enableAutoSessionTracking: true,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  });

  isInitialized = true;
}

export function isSentryInitialized(): boolean {
  return isInitialized;
}
