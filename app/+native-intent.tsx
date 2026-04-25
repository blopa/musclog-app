// This file intercepts native deep link intents before Expo Router processes them.
// On cold start, imperative router.navigate() before the Root Layout mounts causes:
// "Attempted to navigate before mounting the Root Layout component"
//
// Strategy per action:
// - open-camera: stash in global + return '/' — camera is a modal on the home screen,
//   index.tsx reads the global once the navigator is ready.
// - open-nutrition (and any future screen-based actions): return the target route directly.
//   redirectSystemPath sets the *initial* route, which Expo Router handles natively
//   with no imperative navigation involved — no race condition possible.

/** Valid deep link actions that can be processed */
const VALID_ACTIONS = ['open-camera', 'open-nutrition'] as const;
type ValidAction = (typeof VALID_ACTIONS)[number];

/**
 * Validates that the action parameter is in the allowlist of known safe actions.
 * This prevents potential security issues from unexpected deep link parameters.
 */
function isValidAction(action: string | null): action is ValidAction {
  if (!action) {
    return false;
  }

  return VALID_ACTIONS.includes(action as ValidAction);
}

export const redirectSystemPath = ({ path, initial }: { path: string; initial: boolean }) => {
  try {
    if (initial && path.includes('action=')) {
      const fullUrl = `http://localhost${path.startsWith('/') ? path : `/${path}`}`;
      const url = new URL(fullUrl);
      const action = url.searchParams.get('action');

      // Validate action against allowlist to prevent injection attacks
      if (!isValidAction(action)) {
        console.warn(`[redirectSystemPath] Ignoring invalid deep link action: ${action}`);
        return path;
      }

      if (action === 'open-camera') {
        (global as any).__PENDING_WIDGET_ACTION = action;
        return '/app';
      }

      if (action === 'open-nutrition') {
        return '/app/nutrition/food';
      }
    }
  } catch {
    // Fallback: return the path as-is
  }

  return path;
};
