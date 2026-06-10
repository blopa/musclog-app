import { isStaticExport } from '@/constants/platform';
import { isDbReady, waitForDbReady } from '@/database/dbReady';
import { captureException } from '@/utils/sentry';

type BootErrorData = Record<string, string | number | boolean | null | undefined>;

export function captureBootException(error: unknown, context: string, data?: BootErrorData): void {
  console.warn(`[${context}]`, error);

  if (isStaticExport) {
    return;
  }

  void captureBootExceptionWhenDbReady(error, context, data);
}

async function captureBootExceptionWhenDbReady(
  error: unknown,
  context: string,
  data?: BootErrorData
): Promise<void> {
  try {
    if (!isDbReady()) {
      await waitForDbReady();
    }

    await captureException(error, {
      data: {
        context,
        ...data,
      },
    });
  } catch (sentryError) {
    console.warn('[bootErrorReporting] Failed to capture boot exception', sentryError);
  }
}
