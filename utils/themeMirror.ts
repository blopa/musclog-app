import type { ThemeId, ThemeOption } from '@/constants/settings';
import { themeCssVariables } from '@/theme.tokens';

/**
 * The theme preference as the web build can always reach it.
 *
 * It exists because the settings table is not available to every page. On the
 * marketing site nobody has onboarded, so `runDatabaseBootSequence` never calls
 * `markDbReady()` and `SettingsProvider` never subscribes — the site would be
 * stuck on the default palette forever. And even where the table *is* readable,
 * it opens several frames after the first paint, long enough to show a whole
 * page in the wrong colours.
 *
 * So this module holds two things: the preference itself, which is what the
 * site's picker writes and `ThemeProvider` falls back to, and the resolved
 * `--c-*` map, which the blocking script in `app/+html.tsx` replays before the
 * body renders. The settings table stays authoritative wherever it can be read;
 * this is the stand-in, and `ThemeProvider` refreshes it from the real row as
 * soon as one arrives.
 */
export const THEME_MIRROR_STORAGE_KEY = 'musclog_theme';

export type ThemeMirror = {
  preference: ThemeOption;
  /** Filled in by `recordResolvedTheme`; absent until a provider has rendered once. */
  themeId?: ThemeId;
  variables?: Record<string, string>;
};

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Safari in private mode throws on the property access itself.
    return null;
  }
}

function read(): null | ThemeMirror {
  const raw = storage()?.getItem(THEME_MIRROR_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ThemeMirror;
    return parsed?.preference ? parsed : null;
  } catch {
    return null;
  }
}

let snapshot = read();
const listeners = new Set<() => void>();

function commit(next: ThemeMirror): void {
  snapshot = next;

  try {
    storage()?.setItem(THEME_MIRROR_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A full or blocked store costs the pre-paint optimisation, nothing else.
  }

  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToThemeMirror(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getThemeMirror(): null | ThemeMirror {
  return snapshot;
}

/** Server snapshot for `useSyncExternalStore`: static rendering has no storage. */
export function getServerThemeMirror(): null {
  return null;
}

/**
 * Record a preference chosen where the settings table cannot be observed.
 * The palette itself is filled in by `recordResolvedTheme` on the next render.
 */
export function setMirroredThemePreference(preference: ThemeOption): void {
  commit({ ...snapshot, preference });
}

/** Called by `ThemeProvider` with the palette actually in force. */
export function recordResolvedTheme(preference: ThemeOption, themeId: ThemeId): void {
  if (snapshot?.preference === preference && snapshot?.themeId === themeId) {
    return;
  }

  const variables = themeCssVariables[themeId] as Record<string, string> | undefined;
  if (!variables) {
    return;
  }

  commit({ preference, themeId, variables });
}
