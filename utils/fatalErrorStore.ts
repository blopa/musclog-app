/**
 * What happens to an uncaught JS error in a release build (pure; Jest `node`).
 *
 * React Native's default global handler turns every fatal error into a torn-down React instance,
 * and the app closes. When a screen that can say so is mounted (`FatalErrorOverlay`, which
 * subscribes here), a fatal error is shown there instead and the person restarts from it.
 *
 * Order matters and is set in `app/_layout.tsx`: this handler is installed BEFORE Sentry starts,
 * so Sentry's handler wraps it. Sentry reports the error and flushes, then calls the handler it
 * found (this one), which decides between the screen and React Native's default.
 */

export type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;

type ErrorUtilsLike = {
  getGlobalHandler: () => GlobalErrorHandler;
  setGlobalHandler: (handler: GlobalErrorHandler) => void;
};

export type FatalErrorState = { error: unknown } | null;

let shown: FatalErrorState = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A broken listener must not stop the others from showing the screen.
    }
  });
}

export function showFatalError(error: unknown): void {
  shown = { error };
  notify();
}

export function clearFatalError(): void {
  shown = null;
  notify();
}

export function getFatalError(): FatalErrorState {
  return shown;
}

export function subscribeFatalError(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function hasFatalErrorSubscribers(): boolean {
  return listeners.size > 0;
}

export type FatalErrorTarget = {
  show: (error: unknown) => void;
  hasSubscribers: () => boolean;
};

const MODULE_TARGET: FatalErrorTarget = {
  show: showFatalError,
  hasSubscribers: hasFatalErrorSubscribers,
};

/**
 * A fatal error in a release build goes to the screen when one is mounted; everything else (a
 * non-fatal error, development's red box, a fatal with nothing to show it) goes to `previous`.
 * Never throws: on any failure it falls back to `previous`.
 */
export function createGracefulFatalHandler(
  previous: GlobalErrorHandler,
  { isDev, target = MODULE_TARGET }: { isDev: boolean; target?: FatalErrorTarget }
): GlobalErrorHandler {
  return (error, isFatal) => {
    let shownOnScreen = false;

    try {
      if (isFatal && !isDev && target.hasSubscribers()) {
        target.show(error);
        shownOnScreen = true;
      }
    } catch {
      shownOnScreen = false;
    }

    if (!shownOnScreen) {
      previous(error, isFatal);
    }
  };
}

let installed = false;

/** Wraps React Native's global error handler once. A no-op where there is no `ErrorUtils`. */
export function installGracefulFatalHandler(
  errorUtils: ErrorUtilsLike | undefined = (globalThis as { ErrorUtils?: ErrorUtilsLike })
    .ErrorUtils,
  isDev: boolean = typeof __DEV__ === 'undefined' ? false : __DEV__
): void {
  if (installed || !errorUtils?.getGlobalHandler || !errorUtils.setGlobalHandler) {
    return;
  }

  installed = true;
  errorUtils.setGlobalHandler(createGracefulFatalHandler(errorUtils.getGlobalHandler(), { isDev }));
}

/** Test helper: forget the installation and any shown error. */
export function resetFatalErrorStoreForTests(): void {
  installed = false;
  shown = null;
  listeners.clear();
}
