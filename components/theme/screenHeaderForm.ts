import type { NavItemKey } from '@/constants/settings';

export type ScreenHeaderForm = 'root' | 'pushed';

/**
 * Which header a screen shows. A screen that is one of the bottom bar's current slots is a root:
 * the highlighted tab already says where you are, and a back arrow beside it would point nowhere in
 * particular. Every other screen was reached from somewhere (the account menu, a card, another
 * screen) and is `pushed`, so it offers the way back.
 *
 * Slots are user-configurable, so the same screen can be either: Profile is a root for someone who
 * keeps it in the bar and a pushed screen for someone who opens it from the account menu.
 * `destination` is omitted by screens that hide the bottom bar (Progress, Settings), which are
 * therefore always pushed.
 */
export function resolveScreenHeaderForm(
  destination: NavItemKey | undefined,
  slots: Readonly<Record<1 | 2 | 3, NavItemKey>>
): ScreenHeaderForm {
  if (!destination) {
    return 'pushed';
  }

  return Object.values(slots).includes(destination) ? 'root' : 'pushed';
}

type BackRouter = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: '/app') => void;
};

/**
 * Back goes where the user came from. A screen opened cold (a deep link, a notification, a web
 * reload) has no history, so it falls back to Home rather than leaving the button dead.
 */
export function navigateBack(router: BackRouter): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/app');
  }
}
