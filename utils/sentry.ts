// @ts-ignore
import type { ExclusiveEventHintOrCaptureContext } from '@sentry/core/build/types/utils/prepareEvent';
import * as Sentry from '@sentry/react-native';
import type { CaptureContext, SeverityLevel } from '@sentry/types';

export const captureException = async (
  exception: any,
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
