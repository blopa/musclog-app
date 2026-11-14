import { useCallback, useEffect, useMemo, useState } from 'react';

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
// so every access is wrapped and the page works the same without it.
function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing to do: the page keeps working, it just forgets.
  }
}

/**
 * The visitor's unit system, remembered in this browser. It starts as metric on the server and on
 * the first client render so the static HTML and hydration agree, then adopts the stored choice.
 */
export function useToolUnits(): [Units, (units: Units) => void] {
  const [units, setUnitsState] = useState<Units>('metric');

  useEffect(() => {
    const stored = parseStoredUnits(readStorage(TOOL_UNITS_STORAGE_KEY));
    if (stored) {
      setUnitsState(stored);
    }
  }, []);

  const setUnits = useCallback((next: Units) => {
    setUnitsState(next);
    writeStorage(TOOL_UNITS_STORAGE_KEY, next);
  }, []);

  return [units, setUnits];
}

/** The shared "your gym" form for one unit system, remembered per unit system. */
export function useToolGym(units: Units) {
  const [form, setForm] = useState<GymFormState>(() => defaultGymForm(units));

  useEffect(() => {
    setForm(
      parseStoredGymForm(readStorage(GYM_FORM_STORAGE_KEY_PREFIX + units), units) ??
        defaultGymForm(units)
    );
  }, [units]);

  const update = useCallback(
    (next: GymFormState) => {
      setForm(next);
      writeStorage(GYM_FORM_STORAGE_KEY_PREFIX + units, JSON.stringify(next));
    },
    [units]
  );

  const gym = useMemo(() => gymFromForm(form, units), [form, units]);

  return {
    form,
    gym,
    setBarWeight: (barWeight: string) => update({ ...form, barWeight }),
    setPairs: (plate: number, pairs: string) =>
      update({ ...form, pairs: { ...form.pairs, [plateKey(plate)]: pairs } }),
    reset: () => update(defaultGymForm(units)),
  };
}
