import AsyncStorage from '@react-native-async-storage/async-storage';

import { SETTINGS_MIRROR_STORAGE_KEY } from '@/constants/misc';
import type { ThemeOption, Units } from '@/constants/settings';
import { normalizeThemeOption } from '@/utils/themeSelection';

/**
 * The settings the first frame cannot do without, kept outside the database.
 *
 * Every setting lives in the `settings` table, and that table is only readable
 * once the database has opened and `SettingsProvider`'s first query has emitted
 * — behind the boot migrations, which on a large database is long enough to show
 * the whole Home screen with defaults (the wrong theme, the phone's language
 * instead of the app's, metric for an imperial user) and then repaint it. So a
 * copy of the few settings that decide what that first frame looks like is kept
 * in AsyncStorage: `hydrateSettingsMirror` loads it before `AppDbReadyGate`
 * mounts the providers, `SettingsProvider` starts from it, and every settings
 * emission writes it back. The table stays the only authority.
 *
 * Only plain, non-secret values belong here — AsyncStorage is not encrypted.
 * `appLockScopesRaw` is here for a narrower reason than the others, and is read
 * only in the safe direction: see `appLockScopesPending` in `SettingsContext`.
 *
 * Excluded from backups (`ASYNC_STORAGE_EXCLUDED_KEYS`), so a restore removes it
 * rather than carrying another install's lock choice across.
 */
export type MirroredSettings = {
  theme: ThemeOption;
  language: string;
  units: Units;
  appLockScopesRaw: string;
};

let snapshot: MirroredSettings | null = null;
let hydration: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Anything that does not look like a mirror written by this module is no mirror at all. */
function parseMirror(raw: string): MirroredSettings | null {
  const parsed = JSON.parse(raw) as Partial<MirroredSettings> | null;
  if (
    typeof parsed?.theme !== 'string' ||
    typeof parsed.language !== 'string' ||
    parsed.language === '' ||
    (parsed.units !== 'metric' && parsed.units !== 'imperial') ||
    typeof parsed.appLockScopesRaw !== 'string'
  ) {
    return null;
  }

  return {
    theme: normalizeThemeOption(parsed.theme),
    language: parsed.language,
    units: parsed.units,
    appLockScopesRaw: parsed.appLockScopesRaw,
  };
}

async function readMirror(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_MIRROR_STORAGE_KEY);
    // A write that landed while the read was in flight is newer than the disk.
    if (!raw || snapshot) {
      return;
    }

    const mirror = parseMirror(raw);
    if (mirror) {
      snapshot = mirror;
      notify();
    }
  } catch {
    // An unreadable mirror only costs the first frame its stored settings.
  }
}

/**
 * Loads the mirror from AsyncStorage. Idempotent and never rejects. Await it
 * before mounting `SettingsProvider`, which reads it once, on its first render.
 */
export function hydrateSettingsMirror(): Promise<void> {
  hydration ??= readMirror();
  return hydration;
}

export function getSettingsMirror(): MirroredSettings | null {
  return snapshot;
}

export function subscribeToSettingsMirror(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Server snapshot for `useSyncExternalStore`: static rendering has no storage. */
export function getServerSettingsMirror(): null {
  return null;
}

/** Called by `SettingsProvider` with every value it reads from the settings table. */
export function recordSettingsMirror(next: MirroredSettings): void {
  if (
    snapshot?.theme === next.theme &&
    snapshot.language === next.language &&
    snapshot.units === next.units &&
    snapshot.appLockScopesRaw === next.appLockScopesRaw
  ) {
    return;
  }

  snapshot = next;
  notify();
  AsyncStorage.setItem(SETTINGS_MIRROR_STORAGE_KEY, JSON.stringify(next))
    // A failed write costs the next launch its first-frame settings, nothing else.
    .catch(() => {});
}
