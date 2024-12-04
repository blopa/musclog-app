import type { ExclusiveEventHintOrCaptureContext } from '@sentry/core/build/types/utils/prepareEvent';
import type { CaptureContext, SeverityLevel } from '@sentry/types';

import { BUG_REPORT_TYPE } from '@/constants/storage';
import { getSetting } from '@/utils/database';
import * as Sentry from '@sentry/react-native';

export const captureException = async (exception: any, hint?: ExclusiveEventHintOrCaptureContext) => {
    const sentryAllowed = await getSetting(BUG_REPORT_TYPE);

    if (sentryAllowed?.value === 'true') {
        Sentry.captureException(exception, hint);
    }
};

export const captureMessage = async (message: string, captureContext?: CaptureContext | SeverityLevel) => {
    const sentryAllowed = await getSetting(BUG_REPORT_TYPE);

    if (sentryAllowed?.value === 'true') {
        Sentry.captureMessage(message, captureContext);
    }
};
