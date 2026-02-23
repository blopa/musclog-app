// @ts-ignore
import type { ExclusiveEventHintOrCaptureContext } from '@sentry/core/build/types/utils/prepareEvent';
import * as Sentry from '@sentry/react-native';
import type { CaptureContext, SeverityLevel } from '@sentry/types';

export const captureException = async (
  exception: unknown,
  hint?: ExclusiveEventHintOrCaptureContext
) => {
  Sentry.captureException(exception, hint);
};

export const captureMessage = async (
  message: string,
  captureContext?: CaptureContext | SeverityLevel
) => {
  Sentry.captureMessage(message, captureContext);
};

export function setSentryUser(user: { id: string; email?: string } | null) {
  Sentry.setUser(user);
}
