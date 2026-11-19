/**
 * How the bottom bar, the account menu and "back to Home" buttons reach a main destination.
 *
 * Every main destination (Home, Food, Workouts, Profile, Settings, …) is a tab of ONE tab
 * navigator (`app/app/(tabs)/_layout.tsx`), so reaching one is a plain `navigate`:
 * - from a tab, the tab navigator switches to the tab that is already there (kept mounted, up to
 *   the limit in `utils/tabKeepAlive.ts`), and never adds a screen;
 * - from a screen pushed over the tabs (a live workout, its summary), the outer stack's
 *   `singleTabsRouter` turns it into "back to the tab navigator", closing what was above it.
 *
 * Before the tabs, all of these screens were siblings in one stack whose `navigate` pushed a new
 * copy on every tap: fifty rounds of Food → Workouts → Home left 101 live screens and ten-second
 * switches (`docs/FIXES.md`). The bar and the menu go through this module, never the router, so
 * that rule stays in one place (`components/navigation/__tests__/destinationNavigation.test.ts`).
 */

export const HOME_ROUTE = '/app';

/** Method syntax on purpose: expo-router's own methods take its narrower `Href`. */
export type DestinationRouter = {
  navigate(href: string): void;
};

export function goToDestination(router: DestinationRouter, href: string): void {
  router.navigate(href);
}

export function goHome(router: DestinationRouter): void {
  router.navigate(HOME_ROUTE);
}

/** Whether `pathname` is the Home screen. */
export function isHomePath(pathname: string): boolean {
  return pathname === HOME_ROUTE || pathname === `${HOME_ROUTE}/`;
}
