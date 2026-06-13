import { isStaticExport } from '@/constants/platform';
import { waitForDbReady } from '@/database/dbReady';
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
    // Wait for DB-ready so the consent read inside captureException isn't racing
    // the reset window — but swallow a rejection: a failed boot must still report
    // itself. captureException handles a broken DB on its own (reports anyway).
    await waitForDbReady().catch(() => {});

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
