import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { Units } from '@/constants/settings';

import {
  defaultGymForm,
  GYM_FORM_STORAGE_KEY_PREFIX,
  type GymFormState,
  gymFromForm,
  parseStoredGymForm,
  parseStoredUnits,
  plateKey,
  TOOL_UNITS_STORAGE_KEY,
} from './gymForm';

// localStorage is a per-visitor convenience: it can be missing, full or blocked (a private window),
// so every access is wrapped and the page works the same without it. A value that could not be
// written is kept in memory for the rest of the visit, so the form still behaves.
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function readStorage(key: string): string | null {
  if (memory.has(key)) {
    return memory.get(key) ?? null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Kept in memory above.
  }

  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/**
 * A stored string. `null` on the server and on the first client render, so the static HTML and
 * hydration agree; the stored value arrives on the next render.
 */
function useStoredString(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readStorage(key),
    () => null
  );
}

/** The visitor's unit system, remembered in this browser; metric until one is chosen. */
export function useToolUnits(): [Units, (units: Units) => void] {
  const stored = useStoredString(TOOL_UNITS_STORAGE_KEY);
  const setUnits = useCallback((next: Units) => writeStorage(TOOL_UNITS_STORAGE_KEY, next), []);

  return [parseStoredUnits(stored) ?? 'metric', setUnits];
}

/** The shared "your gym" form for one unit system, remembered per unit system. */
export function useToolGym(units: Units) {
  const key = GYM_FORM_STORAGE_KEY_PREFIX + units;
  const stored = useStoredString(key);
  const form = useMemo<GymFormState>(
    () => parseStoredGymForm(stored, units) ?? defaultGymForm(units),
    [stored, units]
  );
  const gym = useMemo(() => gymFromForm(form, units), [form, units]);
  const update = (next: GymFormState) => writeStorage(key, JSON.stringify(next));

  return {
    form,
    gym,
    setBarWeight: (barWeight: string) => update({ ...form, barWeight }),
    setPairs: (plate: number, pairs: string) =>
      update({ ...form, pairs: { ...form.pairs, [plateKey(plate)]: pairs } }),
    reset: () => update(defaultGymForm(units)),
  };
}
