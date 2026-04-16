import { captureException } from './sentry';
import { showSnackbar } from './snackbarService';

type HandleErrorOptions = {
  sendToSentry?: boolean;
  showSnackbar?: boolean;
  snackbarMessage?: string;
  snackbarOptions?: {
    subtitle?: string;
    action?: string;
    onAction?: () => void;
    duration?: number;
  };
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

  if (__DEV__) {
    console.error(consoleMessage || `Error in ${context}:`, error);
  }

  if (shouldShowSnackbar && snackbarMessage) {
    showSnackbar('error', snackbarMessage, snackbarOptions);
  }
}
