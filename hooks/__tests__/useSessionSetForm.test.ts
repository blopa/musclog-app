/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import type { CurrentSetData } from '@/hooks/useActiveWorkout';
import { useSessionSetForm } from '@/hooks/useSessionSetForm';

const setData = (weight: number, overrides: Record<string, unknown> = {}) =>
  ({
    set: { id: 'set-1', weight, reps: 8, partials: 0, repsInReserve: 2, ...overrides },
    exercise: { id: 'bench' },
    setNumber: 1,
    totalSetsInExercise: 3,
    exerciseNumber: 1,
  }) as unknown as CurrentSetData;

type Props = { data: CurrentSetData | null; units: 'metric' | 'imperial' };

function renderForm(initial: Props) {
  return renderHook(({ data, units }: Props) => useSessionSetForm(data, units), {
    initialProps: initial,
  });
}

describe('useSessionSetForm', () => {
  it('shows the stored set in the unit it is given', () => {
    const { result } = renderForm({ data: setData(100), units: 'imperial' });

    expect(result.current.weight).toBeCloseTo(220.46, 2);
    expect(result.current.reps).toBe(8);
    expect(result.current.isStatsDataLoaded).toBe(true);
  });

  it('re-expresses an unsaved edit when only the unit changes, instead of discarding it', () => {
    const data = setData(100);
    const { result, rerender } = renderForm({ data, units: 'metric' });

    act(() => result.current.setWeight(105));
    // A re-emission rebuilds the set object; the stored numbers are what identify it.
    rerender({ data: setData(100), units: 'imperial' });

    expect(result.current.weight).toBeCloseTo(231.49, 2); // 105 kg, not the stored 100 kg
  });

  it('re-reads the form when the stored set changes', () => {
    const { result, rerender } = renderForm({ data: setData(100), units: 'metric' });

    act(() => result.current.setWeight(105));
    rerender({ data: setData(100, { id: 'set-2', reps: 5 }), units: 'imperial' });

    expect(result.current.weight).toBeCloseTo(220.46, 2);
    expect(result.current.reps).toBe(5);
  });

  it('reports nothing loaded when there is no set', () => {
    const { result } = renderForm({ data: null, units: 'metric' });

    expect(result.current.isStatsDataLoaded).toBe(false);
  });
});
