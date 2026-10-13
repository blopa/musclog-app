import { useEffect, useRef, useState } from 'react';

import type { Units } from '@/constants/settings';
import type { CurrentSetData } from '@/hooks/useActiveWorkout';
import { displayToKg, kgToDisplay } from '@/utils/unitConversion';

/** Identifies the stored numbers of a set: a change here means the form must be re-read. */
const storedSetKey = ({ set }: CurrentSetData) =>
  `${set.id}|${set.weight}|${set.reps}|${set.partials}|${set.repsInReserve}`;

/**
 * The numbers the session screen shows for the set in front of the user. The weight is held in
 * the DISPLAY unit (`units`, already resolved for this exercise) and converted to kilograms only
 * when it is saved.
 *
 * The form is re-read from the set whenever the set or its stored numbers change. When only the
 * unit changes — the exercise's unit is switched mid-set — the weight on screen is re-expressed
 * in the new unit instead, so an unsaved edit survives and is never reinterpreted: 100 kg typed
 * becomes 220.5 lb, not 100 lb.
 */
export function useSessionSetForm(currentSetData: CurrentSetData | null, units: Units) {
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(0);
  const [partials, setPartials] = useState(0);
  const [repsInReserve, setRepsInReserve] = useState(0);
  const [isStatsDataLoaded, setIsStatsDataLoaded] = useState(false);
  const syncedRef = useRef<{ key: string; units: Units } | null>(null);

  useEffect(() => {
    const synced = syncedRef.current;
    const key = currentSetData ? storedSetKey(currentSetData) : null;
    syncedRef.current = key === null ? null : { key, units };

    const syncFormInputs = () => {
      if (!currentSetData) {
        setIsStatsDataLoaded(false);
        return;
      }

      if (synced && synced.key === key && synced.units !== units) {
        setWeight((shown) => kgToDisplay(displayToKg(shown, synced.units), units));
        return;
      }

      setWeight(kgToDisplay(currentSetData.set.weight ?? 0, units));
      setReps(currentSetData.set.reps ?? 0);
      setPartials(currentSetData.set.partials || 0);
      setRepsInReserve(currentSetData.set.repsInReserve ?? 0);
      setIsStatsDataLoaded(true);
    };

    syncFormInputs();
  }, [currentSetData, units]);

  return {
    weight,
    setWeight,
    reps,
    setReps,
    partials,
    setPartials,
    repsInReserve,
    setRepsInReserve,
    isStatsDataLoaded,
  };
}
