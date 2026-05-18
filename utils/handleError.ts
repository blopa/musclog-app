import { isProduction } from '@/utils/app';

import { captureException } from './sentry';
import { showSnackbar, type SnackbarOptions } from './snackbarService';

type HandleErrorOptions = {
  sendToSentry?: boolean;
  showSnackbar?: boolean;
  snackbarMessage?: string;
  snackbarOptions?: SnackbarOptions;
  consoleMessage?: string;
};

export async function handleError(
  error: unknown,
  context: string,
  options: HandleErrorOptions = {}
): Promise<void> {
  const {
    sendToSentry = true,
    showSnackbar: shouldShowSnackbar = true,
    snackbarMessage,
    snackbarOptions,
    consoleMessage,
  } = options;

  if (sendToSentry) {
    await captureException(error, { data: { context } });
  }

  if (!isProduction()) {
    console.error(consoleMessage || `Error in ${context}:`, error);
  }

  if (shouldShowSnackbar && snackbarMessage) {
    showSnackbar('error', snackbarMessage, snackbarOptions);
  }
}
