import type { CaptureContext, EventHint, SeverityLevel } from '@sentry/core';
import * as Sentry from '@sentry/react-native';

import { SettingsService } from '@/database/services/SettingsService';
import { initializeSentry } from '@/sentry-init';
import { showSnackbar } from '@/utils/snackbarService';

async function checkConsentAndInitialize(): Promise<boolean> {
  try {
    const settings = await SettingsService.getAnonymousBugReport();

    if (!settings) {
      return false; // User has not consented
    }

    // Initialize Sentry if not already done
    initializeSentry();

    return true;
  } catch (_) {
    // Initialize Sentry anyway if database is broken or something else fails
    initializeSentry();

    // Show message to user about database issue
    showSnackbar('error', 'errors.databaseError.title', {
      subtitle: 'errors.databaseError.description',
    });

    return true;
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
