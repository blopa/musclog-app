/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { Subject } from 'rxjs';

import { WorkoutPlanRepository } from '@/database/repositories/WorkoutPlanRepository';
import { useWorkoutPlans } from '@/hooks/useWorkoutPlans';

jest.mock('@/database/repositories/WorkoutPlanRepository', () => ({
  WorkoutPlanRepository: {
    getAll: jest.fn(),
    getAllMemberships: jest.fn(),
  },
}));

function observableQuery(subject: Subject<any[]>) {
  const observe = jest.fn();
  const observeWithColumns = jest.fn().mockReturnValue({
    subscribe: (observer: any) => subject.subscribe(observer),
  });
  return { observe, observeWithColumns };
}

describe('useWorkoutPlans', () => {
  const plansSubject = new Subject<any[]>();
  const membershipsSubject = new Subject<any[]>();
  const plansQuery = observableQuery(plansSubject);
  const membershipsQuery = observableQuery(membershipsSubject);

  beforeEach(() => {
    jest.clearAllMocks();
    (WorkoutPlanRepository.getAll as jest.Mock).mockReturnValue(plansQuery);
    (WorkoutPlanRepository.getAllMemberships as jest.Mock).mockReturnValue(membershipsQuery);
  });

  it('observes mutable columns and never uses the identity-deduping plain observer', () => {
    renderHook(() => useWorkoutPlans());

    expect(plansQuery.observeWithColumns).toHaveBeenCalledWith([
      'name',
      'description',
      'cycle_type',
      'icon',
      'difficulty',
      'updated_at',
    ]);
    expect(membershipsQuery.observeWithColumns).toHaveBeenCalledWith([
      'plan_id',
      'template_id',
      'week_days_json',
      'position',
      'updated_at',
    ]);
    expect(plansQuery.observe).not.toHaveBeenCalled();
    expect(membershipsQuery.observe).not.toHaveBeenCalled();
  });

  it('waits for both subscriptions and repaints an in-place plan rename', async () => {
    const plan = { id: 'p1', name: 'PPL' };
    const { result } = renderHook(() => useWorkoutPlans());

    act(() => plansSubject.next([plan]));
    expect(result.current.isLoading).toBe(true);
    act(() => membershipsSubject.next([]));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.plans[0].name).toBe('PPL');

    plan.name = 'Push Pull Legs';
    act(() => plansSubject.next([plan]));
    await waitFor(() => expect(result.current.plans[0].name).toBe('Push Pull Legs'));
  });
});
