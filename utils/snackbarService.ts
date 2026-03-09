// TODO: implement a way to pass along a callback function to the snackbars
// so that the CTA button does something other than just close the snackbar
type ShowSnackbarFunction = (
  type: 'success' | 'error',
  message: string,
  options?: {
    subtitle?: string;
    action?: string;
    duration?: number;
  }
) => void;

let showSnackbarRef: ShowSnackbarFunction | null = null;

/**
 * Register the showSnackbar function from SnackbarProvider
 * This should be called by SnackbarProvider on mount
 */
export function registerSnackbarService(showSnackbar: ShowSnackbarFunction) {
  showSnackbarRef = showSnackbar;
}

/**
 * Unregister the snackbar service
 * This should be called by SnackbarProvider on unmount
 */
export function unregisterSnackbarService() {
  showSnackbarRef = null;
}

/**
 * Show a snackbar from anywhere in the codebase
 * Falls back to console.log if snackbar service is not registered
 */
export function showSnackbar(
  type: 'success' | 'error',
  message: string,
  options?: {
    subtitle?: string;
    action?: string;
    duration?: number;
  }
) {
  if (showSnackbarRef) {
    showSnackbarRef(type, message, options);
  } else {
    // Fallback to console if snackbar service is not available
    console.warn('[Snackbar] Service not registered:', message);
  }
}
