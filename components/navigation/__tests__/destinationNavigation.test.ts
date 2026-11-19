/**
 * The bottom bar must switch tabs without stacking screens. Every app screen is a sibling in one
 * expo-router `Stack`, whose `navigate` pushes unless the target is already focused, so a bare
 * `navigate` per tap left 101 live screens after fifty rounds of Food → Workouts → Home and made
 * tab switches take ten seconds (docs/FIXES.md). These tests drive expo-router's own stack
 * reducer, so a router upgrade that changes either half of that story fails here.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  destinationNavigationKind,
  goHome,
  goToDestination,
  HOME_ROUTE,
  isHomePath,
} from '@/components/navigation/destinationNavigation';

// The reducer expo-router's `Stack` runs (vendored React Navigation 7), loaded from its build so
// the test exercises the installed version rather than a copy of its rules.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter');

type Route = { key: string; name: string };
type StackState = {
  type: 'stack';
  key: string;
  stale: false;
  index: number;
  routeNames: string[];
  routes: Route[];
};

const HOME = 'index';
const FOOD = 'nutrition/food';
const WORKOUTS = 'workout/workouts';
const ROUTE_NAMES = [HOME, FOOD, WORKOUTS];
const ROUTE_FOR: Record<string, string> = {
  [FOOD]: '/app/nutrition/food',
  [WORKOUTS]: '/app/workout/workouts',
};

const router = StackRouter({});
const options = { routeNames: ROUTE_NAMES, routeParamList: {}, routeGetIdList: {} };

function initialState(): StackState {
  return {
    type: 'stack',
    key: 'stack-test',
    stale: false,
    index: 0,
    routeNames: ROUTE_NAMES,
    routes: [{ key: 'index-initial', name: HOME }],
  };
}

function reduce(state: StackState, type: 'NAVIGATE' | 'POP_TO' | 'REPLACE', name: string) {
  const result = router.getStateForAction(state, { type, payload: { name } }, options);
  if (!result?.state) {
    throw new Error(`${type} ${name} was not handled`);
  }

  return result.state as StackState;
}

const focused = (state: StackState) => state.routes[state.index].name;

/** What a bar tap does under the rule in `destinationNavigation.ts`. */
function tapWithRule(state: StackState, name: string): StackState {
  if (name === HOME) {
    return reduce(state, 'POP_TO', HOME);
  }

  const kind = destinationNavigationKind(focused(state) === HOME);
  return reduce(state, kind === 'push' ? 'NAVIGATE' : 'POP_TO', name);
}

describe('bottom bar tab switching', () => {
  it('a bare navigate per tap stacks a new screen every time (the reason for the rule)', () => {
    // The old bar: Food replaced the current screen, everything else used navigate.
    let state = initialState();
    for (let round = 0; round < 50; round++) {
      state = reduce(state, 'REPLACE', FOOD);
      state = reduce(state, 'NAVIGATE', WORKOUTS);
      state = reduce(state, 'NAVIGATE', HOME);
    }

    expect(state.routes.length).toBeGreaterThan(100);
  });

  it('keeps the stack at Home plus one destination however fast the taps come', () => {
    let state = initialState();
    let deepest = 0;
    for (let round = 0; round < 50; round++) {
      for (const name of [FOOD, WORKOUTS, HOME, WORKOUTS, FOOD, FOOD, HOME]) {
        state = tapWithRule(state, name);
        deepest = Math.max(deepest, state.routes.length);
        expect(focused(state)).toBe(name);
      }
    }

    expect(deepest).toBeLessThanOrEqual(2);
    expect(state.routes.map((route) => route.name)).toEqual([HOME]);
  });

  it('returns to the original Home instead of mounting a new one', () => {
    let state = initialState();
    state = tapWithRule(state, WORKOUTS);
    state = tapWithRule(state, FOOD);
    expect(state.routes.map((route) => route.name)).toEqual([HOME, FOOD]);

    state = tapWithRule(state, HOME);
    expect(state.routes).toEqual([{ key: 'index-initial', name: HOME }]);
  });

  it('goes back to a destination already in the stack and drops the screens above it', () => {
    // Workouts, then a pushed detail screen on top of it (here: Food standing in for it).
    let state = tapWithRule(initialState(), WORKOUTS);
    state = reduce(state, 'NAVIGATE', FOOD);
    state = tapWithRule(state, WORKOUTS);

    expect(state.routes.map((route) => route.name)).toEqual([HOME, WORKOUTS]);
  });

  it('brings Home back when the stack has none (a cold deep link)', () => {
    let state = reduce(initialState(), 'REPLACE', FOOD);
    state = tapWithRule(state, HOME);

    expect(state.routes.map((route) => route.name)).toEqual([HOME]);
  });
});

describe('goToDestination / goHome', () => {
  const fakeRouter = () => ({ navigate: jest.fn(), dismissTo: jest.fn() });

  it('pushes only from Home', () => {
    const r = fakeRouter();
    goToDestination(r, ROUTE_FOR[FOOD], true);
    expect(r.navigate).toHaveBeenCalledWith(ROUTE_FOR[FOOD]);
    expect(r.dismissTo).not.toHaveBeenCalled();
  });

  it('pops to or replaces with the destination from anywhere else', () => {
    const r = fakeRouter();
    goToDestination(r, ROUTE_FOR[WORKOUTS], false);
    expect(r.dismissTo).toHaveBeenCalledWith(ROUTE_FOR[WORKOUTS]);
    expect(r.navigate).not.toHaveBeenCalled();
  });

  it('goes Home by dismissing to it', () => {
    const r = fakeRouter();
    goHome(r);
    expect(r.dismissTo).toHaveBeenCalledWith(HOME_ROUTE);
    expect(r.navigate).not.toHaveBeenCalled();
  });

  it('recognises the Home path with or without a trailing slash', () => {
    expect(isHomePath('/app')).toBe(true);
    expect(isHomePath('/app/')).toBe(true);
    expect(isHomePath('/app/nutrition/food')).toBe(false);
  });
});

describe('navigation surfaces route through the rule', () => {
  const root = join(__dirname, '..', '..', '..');

  it.each(['components/NavigationMenu.tsx', 'components/modals/UserMenuModal.tsx'])(
    '%s never calls the router directly',
    (file) => {
      const source = readFileSync(join(root, file), 'utf8');
      expect(source).not.toMatch(/router\.(navigate|push|replace)\(/);
    }
  );
});
