import { captureException } from './sentry';
import { showSnackbar } from './snackbarService';

type HandleErrorOptions = {
  sendToSentry?: boolean;
  showSnackbar?: boolean;
  snackbarMessage?: string;
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
    consoleMessage,
  } = options;

  if (sendToSentry) {
    await captureException(error, { data: { context } });
  }

  if (__DEV__) {
    console.error(consoleMessage || `Error in ${context}:`, error);
  }

  if (shouldShowSnackbar && snackbarMessage) {
    showSnackbar('error', snackbarMessage);
  }
}
