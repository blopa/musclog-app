import type { CaptureContext, EventHint, SeverityLevel } from '@sentry/core';
import * as Sentry from '@sentry/react-native';

import { SettingsService } from '@/database/services/SettingsService';
import { initializeSentry, isSentryInitialized } from '@/sentry-init';

async function checkConsentAndInitialize(): Promise<boolean> {
  try {
    // Get the current anonymousBugReport setting
    const settings = await SettingsService.getAnonymousBugReport();

    if (!settings) {
      return false; // User has not consented
    }

    // Initialize Sentry if not already done
    if (!isSentryInitialized()) {
      initializeSentry();
    }

    return true;
  } catch (error) {
    console.error('[Sentry] Error checking consent:', error);
    return false;
  }
}

export const captureException = async (exception: unknown, hint?: EventHint) => {
  const hasConsent = await checkConsentAndInitialize();
  if (hasConsent) {
    Sentry.captureException(exception, hint);
  }
};

export const captureMessage = async (
  message: string,
  captureContext?: CaptureContext | SeverityLevel
) => {
  const hasConsent = await checkConsentAndInitialize();
  if (hasConsent) {
    Sentry.captureMessage(message, captureContext);
  }
};

export async function setSentryUser(user: { id: string; email?: string } | null) {
  const hasConsent = await checkConsentAndInitialize();
  if (hasConsent) {
    Sentry.setUser(user);
  }
}
