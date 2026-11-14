import type { CaptureContext, EventHint, SeverityLevel } from '@sentry/core';
import * as Sentry from '@sentry/react-native';

import { SettingsService } from '@/database/services/SettingsService';
import i18n from '@/lang/lang';
import { initializeSentry } from '@/sentry-init';
import { readRememberedCrashReportConsent } from '@/utils/crashReportConsent';
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
    // The database is unreadable: fall back to the device-local copy of the user's choice.
    // Never recorded (null) keeps the default, which is on.
    const remembered = await readRememberedCrashReportConsent();

    // Show message to user about database issue
    showSnackbar('error', i18n.t('errors.databaseError.title'), {
      subtitle: i18n.t('errors.databaseError.description'),
    });

    if (remembered === false) {
      return false;
    }

    initializeSentry();

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
