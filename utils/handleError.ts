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
    // A hint's `data` is never serialized onto the event, so the context must travel as a tag.
    await captureException(error, { captureContext: { tags: { context } } });
  }

  if (!isProduction()) {
    console.error(consoleMessage || `Error in ${context}:`, error);
  }

  if (shouldShowSnackbar && snackbarMessage) {
    showSnackbar('error', snackbarMessage, snackbarOptions);
  }
}
