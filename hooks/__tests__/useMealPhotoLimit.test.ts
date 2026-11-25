import { renderHook, waitFor } from '@testing-library/react';

import { useMealPhotoLimit } from '@/hooks/useMealPhotoLimit';
import { AiService } from '@/services/AiService';
import { handleError } from '@/utils/handleError';
import { loadHostedMaxImages } from '@/utils/hostedImage';
import { MAX_MEAL_PHOTOS } from '@/utils/mealPhotoDraft';

jest.mock('@/services/AiService', () => ({
  AiService: { getAiConfig: jest.fn() },
}));

jest.mock('@/utils/hostedImage', () => ({
  loadHostedMaxImages: jest.fn(),
}));

jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

describe('useMealPhotoLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to MAX_MEAL_PHOTOS for 1-arg callers when inactive', () => {
    const { result } = renderHook(() => useMealPhotoLimit(false));

    expect(result.current).toBe(MAX_MEAL_PHOTOS);
    expect(AiService.getAiConfig).not.toHaveBeenCalled();
  });

  it('initializes to 1 for hosted provider and updates from loadHostedMaxImages', async () => {
    jest.mocked(AiService.getAiConfig).mockResolvedValue({ provider: 'hosted' } as never);
    jest.mocked(loadHostedMaxImages).mockResolvedValue(3);

    const { result } = renderHook(() => useMealPhotoLimit(true, 'hosted'));

    expect(result.current).toBe(1);

    await waitFor(() => {
      expect(result.current).toBe(3);
    });
  });

  it('falls back to 1 for hosted provider when reading config fails or returns null', async () => {
    jest.mocked(AiService.getAiConfig).mockRejectedValueOnce(new Error('boom'));

    const { result, rerender } = renderHook(
      ({ active, provider }) => useMealPhotoLimit(active, provider),
      { initialProps: { active: true, provider: 'hosted' as const } }
    );

    await waitFor(() => {
      expect(AiService.getAiConfig).toHaveBeenCalledTimes(1);
    });
    expect(result.current).toBe(1);

    jest.mocked(AiService.getAiConfig).mockResolvedValueOnce(null);
    rerender({ active: false, provider: 'hosted' });
    rerender({ active: true, provider: 'hosted' });

    await waitFor(() => {
      expect(AiService.getAiConfig).toHaveBeenCalledTimes(2);
    });
    expect(result.current).toBe(1);
  });

  it('resets safely to 1 when switching provider to hosted while inactive', () => {
    const { result, rerender } = renderHook(
      ({ active, provider }: { active: boolean; provider?: 'gemini' | 'hosted' | null }) =>
        useMealPhotoLimit(active, provider),
      { initialProps: { active: false, provider: 'gemini' as const } }
    );

    expect(result.current).toBe(MAX_MEAL_PHOTOS);

    rerender({ active: false, provider: 'hosted' });
    expect(result.current).toBe(1);
  });

  it('returns MAX_MEAL_PHOTOS for non-hosted providers and on error', async () => {
    jest.mocked(AiService.getAiConfig).mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useMealPhotoLimit(true, 'gemini'));

    await waitFor(() => {
      expect(AiService.getAiConfig).toHaveBeenCalledTimes(1);
    });
    expect(result.current).toBe(MAX_MEAL_PHOTOS);
  });

  it('reports a failed config read once and still falls back', async () => {
    const error = new Error('boom');
    jest.mocked(AiService.getAiConfig).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useMealPhotoLimit(true, 'openai'));

    await waitFor(() => {
      expect(result.current).toBe(MAX_MEAL_PHOTOS);
    });
    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledWith(error, 'useMealPhotoLimit', {
      showSnackbar: false,
    });
  });
});
