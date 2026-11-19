/**
 * Switching between the main destinations must never stack screens. Before the tab navigator,
 * every screen was a sibling in one expo-router `Stack` whose `navigate` pushes unless the target
 * is focused, so fifty rounds of Food → Workouts → Home left 101 live screens and ten-second
 * switches (docs/FIXES.md). These tests drive expo-router's own reducers (the vendored React
 * Navigation 7 routers), so a router upgrade that changes any of this fails here.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  goHome,
  goToDestination,
  HOME_ROUTE,
  isHomePath,
} from '@/components/navigation/destinationNavigation';
import {
  rewriteTabsAction,
  singleTabsRouter,
  TABS_ROUTE_NAME,
} from '@/components/navigation/singleTabsRouter';

// Loaded from expo-router's build so the test exercises the installed routers, not a copy.
/* eslint-disable @typescript-eslint/no-require-imports */
const { StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter');
const { TabRouter } = require('expo-router/build/react-navigation/routers/TabRouter');
/* eslint-enable @typescript-eslint/no-require-imports */

type Route = { key: string; name: string; state?: unknown };
type State = {
  type: string;
  key: string;
  stale: false;
  index: number;
  routeNames: string[];
  routes: Route[];
  history?: unknown[];
};
type Reducer = {
  getStateForAction: (state: State, action: object, options: object) => unknown;
};

const HOME = 'index';
const FOOD = 'nutrition/food';
const WORKOUTS = 'workout/workouts';
const SESSION = 'workout/workout-session';
const SUMMARY = 'workout/workout-summary';

function reduce(router: Reducer, state: State, action: object, routeNames: string[]): State {
  const result = router.getStateForAction(state, action, {
    routeNames,
    routeParamList: {},
    routeGetIdList: {},
  }) as { state?: State } | string | null;
  if (!result || typeof result === 'string' || !result.state) {
    throw new Error(`${JSON.stringify(action)} was not handled`);
  }

  return result.state;
}

describe('the old flat stack (why the tabs exist)', () => {
  it('a bare navigate per tap stacks a new screen every time', () => {
    const names = [HOME, FOOD, WORKOUTS];
    const stack = StackRouter({});
    let state: State = {
      type: 'stack',
      key: 'stack-flat',
      stale: false,
      index: 0,
      routeNames: names,
      routes: [{ key: 'home-0', name: HOME }],
    };
    for (let round = 0; round < 50; round++) {
      state = reduce(stack, state, { type: 'REPLACE', payload: { name: FOOD } }, names);
      state = reduce(stack, state, { type: 'NAVIGATE', payload: { name: WORKOUTS } }, names);
      state = reduce(stack, state, { type: 'NAVIGATE', payload: { name: HOME } }, names);
    }

    expect(state.routes.length).toBeGreaterThan(100);
  });
});

describe('the tab navigator', () => {
  const names = [HOME, FOOD, WORKOUTS];
  const tabs = TabRouter({ backBehavior: 'firstRoute' });
  const initial = (): State => ({
    type: 'tab',
    key: 'tab-test',
    stale: false,
    index: 0,
    routeNames: names,
    routes: names.map((name) => ({ key: `${name}-key`, name })),
    history: [{ type: 'route', key: `${HOME}-key` }],
  });

  it('switches between the same routes however fast the taps come', () => {
    let state = initial();
    for (let round = 0; round < 50; round++) {
      for (const name of [FOOD, WORKOUTS, HOME, WORKOUTS, FOOD, HOME]) {
        state = reduce(tabs, state, { type: 'NAVIGATE', payload: { name } }, names);
        expect(state.routes[state.index].name).toBe(name);
      }
    }

    // Same three routes with the same keys: each tab's screen is reused, never rebuilt.
    expect(state.routes).toEqual(initial().routes);
  });

  it('goes back to Home from another tab, and leaves the app from Home', () => {
    let state = reduce(tabs, initial(), { type: 'NAVIGATE', payload: { name: FOOD } }, names);
    state = reduce(tabs, state, { type: 'GO_BACK' }, names);
    expect(state.routes[state.index].name).toBe(HOME);

    const fromHome = tabs.getStateForAction(state, { type: 'GO_BACK' }, { routeNames: names });
    expect(typeof fromHome === 'string' || fromHome === null).toBe(true);
  });
});

describe('singleTabsRouter (one tab navigator in the outer stack)', () => {
  const names = [TABS_ROUTE_NAME, SESSION, SUMMARY];
  const original = StackRouter({});
  const stack: Reducer = { ...original, ...singleTabsRouter(original as never) };
  const nestedTabs = { type: 'tab', index: 1, routes: [{ name: FOOD }] };
  // expo-router marks the nested state it resolves; the router ignores unmarked state.
  const resolvedNestedTabs = { ...nestedTabs, __internal__routerActionState: true };
  const withTabsBelow = (): State => ({
    type: 'stack',
    key: 'stack-app',
    stale: false,
    index: 2,
    routeNames: names,
    routes: [
      { key: 'tabs-0', name: TABS_ROUTE_NAME },
      { key: 'session-0', name: SESSION },
      { key: 'summary-0', name: SUMMARY },
    ],
  });

  it.each(['NAVIGATE', 'PUSH', 'REPLACE'])(
    '%s to a tab from a pushed screen goes back to the tab navigator already there',
    (type) => {
      const state = reduce(
        stack,
        withTabsBelow(),
        { type, payload: { name: TABS_ROUTE_NAME, state: resolvedNestedTabs } },
        names
      );

      expect(state.routes.map((route) => route.key)).toEqual(['tabs-0']);
      expect(state.routes[0].state).toEqual(nestedTabs);
    }
  );

  it('creates the tab navigator normally when there is none yet (a cold deep link)', () => {
    const state = reduce(
      stack,
      { ...withTabsBelow(), index: 0, routes: [{ key: 'summary-0', name: SUMMARY }] },
      { type: 'REPLACE', payload: { name: TABS_ROUTE_NAME } },
      names
    );

    expect(state.routes.map((route) => route.name)).toEqual([TABS_ROUTE_NAME]);
    expect(state.routes[0].key).not.toBe('summary-0');
  });

  it('leaves every other screen alone', () => {
    const action = { type: 'NAVIGATE', payload: { name: SESSION } };
    expect(rewriteTabsAction(withTabsBelow(), action)).toBe(action);

    const goBack = { type: 'GO_BACK' };
    expect(rewriteTabsAction(withTabsBelow(), goBack)).toBe(goBack);
  });

  it('ignores a tab navigator that is only preloaded above the focused screen', () => {
    const state = { index: 0, routes: [{ name: SESSION }, { name: TABS_ROUTE_NAME }] };
    const action = { type: 'NAVIGATE', payload: { name: TABS_ROUTE_NAME } };
    expect(rewriteTabsAction(state, action)).toBe(action);
  });
});

describe('goToDestination / goHome', () => {
  it('navigates, which the tab navigator turns into a switch', () => {
    const router = { navigate: jest.fn() };
    goToDestination(router, '/app/nutrition/food');
    goHome(router);
    expect(router.navigate.mock.calls).toEqual([['/app/nutrition/food'], [HOME_ROUTE]]);
  });

  it('recognises the Home path with or without a trailing slash', () => {
    expect(isHomePath('/app')).toBe(true);
    expect(isHomePath('/app/')).toBe(true);
    expect(isHomePath('/app/nutrition/food')).toBe(false);
  });
});

describe('wiring', () => {
  const root = join(__dirname, '..', '..', '..');
  const source = (file: string) => readFileSync(join(root, file), 'utf8');

  it.each(['components/NavigationMenu.tsx', 'components/modals/UserMenuModal.tsx'])(
    '%s reaches destinations through destinationNavigation, never the router',
    (file) => {
      expect(source(file)).not.toMatch(/router\.(navigate|push|replace|dismissTo)\(/);
    }
  );

  it('the outer stack runs singleTabsRouter', () => {
    expect(source('app/app/_layout.tsx')).toMatch(/UNSTABLE_router=\{singleTabsRouter\}/);
  });

  it('declares every screen of the (tabs) folder, or expo-router redirects it to Home', () => {
    const tabsDir = join(root, 'app', 'app', '(tabs)');
    const screens: string[] = [];
    const walk = (dir: string, prefix: string) => {
      for (const entry of require('fs').readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          walk(join(dir, entry.name), `${prefix}${entry.name}/`);
        } else if (/\.tsx$/.test(entry.name) && !entry.name.startsWith('_')) {
          screens.push(prefix + entry.name.replace(/(\.web|\.native)?\.tsx$/, ''));
        }
      }
    };
    walk(tabsDir, '');

    const layout = source('app/app/(tabs)/_layout.tsx');
    const declared = [...layout.matchAll(/^\s*'([^']+)',$/gm)].map((m) => m[1]);
    expect([...new Set(screens)].sort()).toEqual([...declared].sort());
    expect(declared[0]).toBe('index');
  });

  it('every bar destination is a tab of the tab navigator', () => {
    const navDestinations = source('components/navigation/navDestinations.ts');
    const routes = [...navDestinations.matchAll(/route: '\/app\/([^']+)'/g)].map((m) => m[1]);
    expect(routes.length).toBeGreaterThan(5);
    // The Weekly Review route is a constant there (WEEKLY_REVIEW_ROUTE), so it is named here.
    for (const route of [...routes, 'index', 'weekly-review']) {
      expect(() => source(`app/app/(tabs)/${route}.tsx`)).not.toThrow();
    }
  });
});
