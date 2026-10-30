/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { COMPOSER_SAVE_DELAY_MS, useAiOnboardingDraft } from '@/hooks/useAiOnboardingDraft';
import {
  deleteAiDraft,
  newDraft,
  readAiDraft,
  writeAiDraft,
} from '@/utils/aiOnboarding/draftStorage';

jest.mock('@/utils/aiOnboarding/draftStorage', () => ({
  readAiDraft: jest.fn(),
  writeAiDraft: jest.fn(),
  deleteAiDraft: jest.fn(),
  newDraft: jest.fn(),
}));

const mockRead = readAiDraft as jest.Mock;
const mockWrite = writeAiDraft as jest.Mock;
const mockDelete = deleteAiDraft as jest.Mock;
const mockNew = newDraft as jest.Mock;

const record = (overrides = {}) => ({
  v: 1,
  draftId: 'saved',
  mode: 'onboarding',
  path: 'chat',
  provider: 'gemini',
  skipMusclogApi: false,
  messages: [],
  composer: '',
  answers: {},
  updatedAt: 1,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockWrite.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
  mockNew.mockImplementation((mode: string) => record({ draftId: 'fresh', mode, provider: null }));
});

describe('useAiOnboardingDraft', () => {
  it('loads a saved session and says it can be resumed', async () => {
    mockRead.mockResolvedValue(record());

    const { result } = renderHook(() => useAiOnboardingDraft('onboarding'));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockRead).toHaveBeenCalledWith('onboarding');
    expect(result.current).toMatchObject({ hasSaved: true, draft: { draftId: 'saved' } });
  });

  it('starts a fresh session that is not written until something changes', async () => {
    mockRead.mockResolvedValue(null);

    const { result } = renderHook(() => useAiOnboardingDraft('profile'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current).toMatchObject({
      hasSaved: false,
      draft: { draftId: 'fresh', mode: 'profile' },
    });
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('writes updates in order, merged into the current session', async () => {
    mockRead.mockResolvedValue(record());
    const { result } = renderHook(() => useAiOnboardingDraft('onboarding'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.update({ provider: 'openai' });
      await result.current.update({ answers: { gender: 'male' } });
    });

    expect(mockWrite).toHaveBeenNthCalledWith(1, expect.objectContaining({ provider: 'openai' }));
    expect(mockWrite).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ provider: 'openai', answers: { gender: 'male' } })
    );
    expect(result.current.draft?.answers).toEqual({ gender: 'male' });
  });

  it('saves composer text after a pause, not on every keystroke', async () => {
    jest.useFakeTimers();
    try {
      mockRead.mockResolvedValue(record());
      const { result } = renderHook(() => useAiOnboardingDraft('onboarding'));
      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        result.current.setComposer('my');
        result.current.setComposer('my weight');
      });
      expect(result.current.draft?.composer).toBe('my weight');
      expect(mockWrite).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(COMPOSER_SAVE_DELAY_MS);
        await Promise.resolve();
      });
      expect(mockWrite).toHaveBeenCalledTimes(1);
      expect(mockWrite).toHaveBeenCalledWith(expect.objectContaining({ composer: 'my weight' }));
    } finally {
      jest.useRealTimers();
    }
  });

  it('saves a pending composer change when the screen goes away', async () => {
    jest.useFakeTimers();
    try {
      mockRead.mockResolvedValue(record());
      const { result, unmount } = renderHook(() => useAiOnboardingDraft('onboarding'));
      await act(async () => {
        await Promise.resolve();
      });

      act(() => result.current.setComposer('unsent'));
      unmount();
      await Promise.resolve();

      expect(mockWrite).toHaveBeenCalledWith(expect.objectContaining({ composer: 'unsent' }));
    } finally {
      jest.useRealTimers();
    }
  });

  it('starts over: deletes the saved session and hands back a fresh one', async () => {
    mockRead.mockResolvedValue(record());
    const { result } = renderHook(() => useAiOnboardingDraft('onboarding'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let fresh: { draftId: string } | undefined;
    await act(async () => {
      fresh = await result.current.startOver();
    });

    expect(mockDelete).toHaveBeenCalled();
    expect(fresh?.draftId).toBe('fresh');
    expect(result.current).toMatchObject({ hasSaved: false, draft: { draftId: 'fresh' } });
  });

  it('writes nothing more once discarded, so a finished session is not brought back', async () => {
    mockRead.mockResolvedValue(record());
    const { result } = renderHook(() => useAiOnboardingDraft('onboarding'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.discard());
    await act(async () => {
      await result.current.update({ provider: 'openai' });
      result.current.setComposer('late');
    });

    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('survives a failed write', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockRead.mockResolvedValue(record());
    mockWrite.mockRejectedValueOnce(new Error('disk'));
    const { result } = renderHook(() => useAiOnboardingDraft('onboarding'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.update({ provider: 'openai' });
      await result.current.update({ provider: 'gemini' });
    });

    expect(mockWrite).toHaveBeenCalledTimes(2);
  });

  it('ignores updates that arrive before the session has loaded', async () => {
    mockRead.mockResolvedValue(record());
    const { result } = renderHook(() => useAiOnboardingDraft('onboarding'));

    await act(async () => {
      await result.current.update({ provider: 'openai' });
      result.current.setComposer('early');
    });

    expect(mockWrite).not.toHaveBeenCalled();
  });
});
