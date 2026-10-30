/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';

import { WorkoutService } from '@/database/services/WorkoutService';
import { useTemplateHasSessions } from '@/hooks/useTemplateHasSessions';

jest.mock('@/database/services/WorkoutService', () => ({
  WorkoutService: { hasCompletedSessions: jest.fn() },
}));

const hasCompletedSessions = WorkoutService.hasCompletedSessions as jest.Mock;

beforeEach(() => hasCompletedSessions.mockReset());

describe('useTemplateHasSessions', () => {
  it('is false and asks nothing without a template or while disabled', () => {
    const { result: none } = renderHook(() => useTemplateHasSessions(undefined, true));
    const { result: off } = renderHook(() => useTemplateHasSessions('tpl-1', false));

    expect(none.current).toBe(false);
    expect(off.current).toBe(false);
    expect(hasCompletedSessions).not.toHaveBeenCalled();
  });

  it('turns true once the template is known to have a completed session', async () => {
    hasCompletedSessions.mockResolvedValue(true);

    const { result } = renderHook(() => useTemplateHasSessions('tpl-1', true));

    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('is false for a template without sessions or when the lookup fails', async () => {
    hasCompletedSessions.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('boom'));

    const { result: empty } = renderHook(() => useTemplateHasSessions('tpl-1', true));
    const { result: failing } = renderHook(() => useTemplateHasSessions('tpl-2', true));

    await waitFor(() => expect(hasCompletedSessions).toHaveBeenCalledTimes(2));
    expect(empty.current).toBe(false);
    expect(failing.current).toBe(false);
  });

  it("does not show the previous template's answer for the next one", async () => {
    hasCompletedSessions.mockImplementation(async (id: string) => id === 'tpl-1');

    const { result, rerender } = renderHook(({ id }) => useTemplateHasSessions(id, true), {
      initialProps: { id: 'tpl-1' },
    });
    await waitFor(() => expect(result.current).toBe(true));

    rerender({ id: 'tpl-2' });

    expect(result.current).toBe(false);
  });
});
