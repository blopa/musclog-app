// This file intercepts native deep link intents before Expo Router processes them.
// On cold start, navigating before the Root Layout mounts causes:
// "Attempted to navigate before mounting the Root Layout component"
// The fix: on cold start (initial === true), stash the action in a global and
// return '/' so the navigator mounts cleanly. index.tsx then reads the global
// once navigation is ready.

export const redirectSystemPath = ({ path, initial }: { path: string; initial: boolean }) => {
  try {
    if (initial && path.includes('action=')) {
      // Parse the action from the path/query string
      const fullUrl = `http://localhost${path.startsWith('/') ? path : `/${path}`}`;
      const url = new URL(fullUrl);
      const action = url.searchParams.get('action');
      if (action) {
        (global as any).__PENDING_WIDGET_ACTION = action;
      }

      // Return root so the navigator mounts before any navigation fires
      return '/';
    }
  } catch {
    // Fallback: just return the path as-is
  }

  return path;
};
