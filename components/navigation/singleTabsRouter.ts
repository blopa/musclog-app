import type { Stack } from 'expo-router';
import type { ComponentProps } from 'react';

type StackRouterOverride = NonNullable<ComponentProps<typeof Stack>['UNSTABLE_router']>;

/**
 * The route the `app/app/(tabs)/` group mounts as inside the app's outer `Stack`.
 *
 * The main destinations (Home, Food, Workouts, Profile, …) live in ONE tab navigator, and the
 * other screens (a live workout, its summary, settings sub-pages, onboarding) are pushed over it
 * in the outer stack. That stack's `navigate`, `push` and `replace` add a route unless the
 * target is the focused one, so a tap on the bottom bar of a pushed screen, or any
 * `router.navigate('/app/nutrition/food')` from one, would mount a SECOND tab navigator with a
 * second copy of every tab it had kept alive. That is the pile-up that made tab switches take ten
 * seconds (`docs/FIXES.md`), one level up.
 */
export const TABS_ROUTE_NAME = '(tabs)';

type StackLikeState = {
  index: number;
  routes: readonly { name: string }[];
};

type RoutingAction = {
  type: string;
  payload?: object;
} & Record<string, unknown>;

/**
 * Turns any action that would add another tab navigator into "go back to the one already in the
 * stack", which closes the screens above it and applies the nested tab change to it. Everything
 * else passes through untouched, as does an action when no tab navigator is in the stack yet
 * (a cold deep link into a pushed screen), so that first one is created normally.
 */
export function rewriteTabsAction<A extends RoutingAction>(state: StackLikeState, action: A): A {
  if (action.type !== 'NAVIGATE' && action.type !== 'PUSH' && action.type !== 'REPLACE') {
    return action;
  }

  const payload = action.payload as { name?: unknown } | undefined;
  if (payload?.name !== TABS_ROUTE_NAME) {
    return action;
  }

  const activeRoutes = state.routes.slice(0, state.index + 1);
  if (!activeRoutes.some((route) => route.name === TABS_ROUTE_NAME)) {
    return action;
  }

  return { ...action, type: 'NAVIGATE', payload: { ...payload, pop: true } };
}

/**
 * `UNSTABLE_router` for the outer `Stack` (`app/app/_layout.tsx`). It must stay a pure function
 * of `original`: React Navigation builds the router once. expo-router resolves an href by
 * reducing through this same router, so the nested tab state it computes is the one for the
 * existing tab navigator.
 */
export const singleTabsRouter: StackRouterOverride = (original) => ({
  getStateForAction(state, action, options) {
    const rewritten = rewriteTabsAction(
      state as unknown as StackLikeState,
      action as unknown as RoutingAction
    ) as unknown as typeof action;
    return original.getStateForAction(state, rewritten, options);
  },
});
