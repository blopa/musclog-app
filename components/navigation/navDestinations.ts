import {
  BarChart3,
  Calendar,
  ClipboardCheck,
  Dumbbell,
  type LucideIcon,
  MessageSquare,
  Settings,
  StickyNote,
  User,
  UtensilsCrossed,
} from 'lucide-react-native';

import type { NavItemKey } from '@/constants/settings';

export type NavDestination = {
  icon: LucideIcon;
  /** Label in the bottom bar, where space is tight. */
  labelKey: string;
  /** Label in the account menu, which has room for a fuller phrasing. */
  menuLabelKey: string;
  /**
   * Where this destination navigates. `null` for `coach`, which opens a modal rather than a route
   * — every surface that lists it supplies its own handler and skips routing entirely.
   */
  route: null | string;
};

/**
 * Every navigation destination's icon, labels and route, shared by all three surfaces that list
 * destinations: the bottom bar (`NavigationMenu`), the account menu (`UserMenuModal`) and the slot
 * picker (`VisualSettingsModal`). A destination therefore picks its icon and route **once**.
 *
 * Bar-specific routing modifiers (which prefix marks the tab active, prefetch, replace) stay in
 * `NAV_SLOTS` in `NavigationMenu.tsx` — they mean nothing to the other two surfaces.
 *
 * Being a `Record<NavItemKey, …>` is load-bearing: adding a key to `NAV_ITEM_KEYS` fails the build
 * here until the destination is described, rather than silently going missing from a menu.
 *
 * Labels are spelled out rather than derived from the key (`userMenu.${key}`) so
 * `scripts/check-translations.js` — which scans `*Key:` fields in `components/**` — can see them.
 *
 * `as const satisfies` rather than a plain annotation: the `satisfies` half still forces every key
 * to be present and well-shaped, while `as const` keeps each entry's literal type. That is what
 * lets `NavigationMenu` read `route` as a plain `string` once `coach` (the only `null` route) has
 * been branched away — no cast, and no fallback branch papering over the invariant.
 */
export const NAV_DESTINATIONS = {
  workouts: {
    icon: Dumbbell,
    labelKey: 'home.navigation.workouts',
    menuLabelKey: 'userMenu.workouts',
    route: '/app/workout/workouts',
  },
  food: {
    icon: UtensilsCrossed,
    labelKey: 'home.navigation.food',
    menuLabelKey: 'userMenu.food',
    route: '/app/nutrition/food',
  },
  profile: {
    icon: User,
    labelKey: 'home.navigation.profile',
    menuLabelKey: 'userMenu.profile',
    route: '/app/profile',
  },
  coach: {
    icon: MessageSquare,
    labelKey: 'home.navigation.coach',
    menuLabelKey: 'userMenu.coach',
    route: null,
  },
  cycle: {
    icon: Calendar,
    labelKey: 'userMenu.cycle',
    menuLabelKey: 'userMenu.cycle',
    route: '/app/cycle',
  },
  settings: {
    icon: Settings,
    labelKey: 'userMenu.settings',
    menuLabelKey: 'userMenu.settings',
    route: '/app/settings',
  },
  progress: {
    icon: BarChart3,
    labelKey: 'userMenu.progress',
    menuLabelKey: 'userMenu.progress',
    route: '/app/progress',
  },
  checkin: {
    icon: ClipboardCheck,
    labelKey: 'home.navigation.checkin',
    menuLabelKey: 'userMenu.checkin',
    route: '/app/nutrition/checkin-list',
  },
  notes: {
    icon: StickyNote,
    labelKey: 'userMenu.notes',
    menuLabelKey: 'userMenu.notes',
    route: '/app/notes',
  },
} as const satisfies Record<NavItemKey, NavDestination>;
