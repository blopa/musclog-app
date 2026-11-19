/**
 * How the bottom bar and the account menu reach a top-level destination.
 *
 * Every app screen is a sibling in ONE expo-router `Stack` (`app/app/_layout.tsx`), and that
 * stack's `navigate` PUSHES a new screen unless the target is already the focused one: it never
 * goes back to a copy further down. Tapping the bar therefore used to stack a fresh, fully
 * mounted Home / Food / Workouts on every switch, each still observing (and decrypting from) the
 * database. Fifty rounds of Food → Workouts → Home left 101 screens alive; tab switches slowed
 * to ten seconds and the process was eventually killed for memory (`docs/FIXES.md`).
 *
 * The rule here keeps the stack at most Home plus one destination for anything the bar does:
 * - Home goes BACK to the Home already open (`dismissTo` pops to it, or replaces the current
 *   screen when there is none), unmounting everything above it.
 * - From Home, a destination is pushed, so Android back returns to Home.
 * - From anywhere else, a destination is reached with `dismissTo`: back to it when it is
 *   already in the stack, otherwise it replaces the current screen. It never adds one.
 *
 * Pinned against the real router reducer by `components/navigation/__tests__/destinationNavigation.test.ts`.
 */

export const HOME_ROUTE = '/app';

/** Method syntax on purpose: expo-router's own methods take its narrower `Href`. */
export type DestinationRouter = {
  navigate(href: string): void;
  dismissTo(href: string): void;
};

/** `push` only from Home; every other tab switch reuses or replaces a screen. */
export function destinationNavigationKind(onHome: boolean): 'push' | 'popTo' {
  return onHome ? 'push' : 'popTo';
}

export function goToDestination(router: DestinationRouter, href: string, onHome: boolean): void {
  if (destinationNavigationKind(onHome) === 'push') {
    router.navigate(href);
  } else {
    router.dismissTo(href);
  }
}

export function goHome(router: DestinationRouter): void {
  router.dismissTo(HOME_ROUTE);
}

/** Whether `pathname` is the Home screen, the one place a destination is pushed from. */
export function isHomePath(pathname: string): boolean {
  return pathname === HOME_ROUTE || pathname === `${HOME_ROUTE}/`;
}
