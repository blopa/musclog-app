import { act, renderHook } from '@testing-library/react';

import { logTrackedMeal } from '@/services/trackedMealLogging';
import { copyImageToDocumentDirectory, deleteFoodImage } from '@/utils/file';

import { useMealCameraSession } from '../useMealCameraSession';

let mockFlow: 'quick' | 'detailed' = 'quick';
const mockEstimate = jest.fn();

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ aiMealCameraFlow: mockFlow, aiProvider: 'gemini' }),
}));
jest.mock('@/hooks/useMealPhotoLimit', () => ({ useMealPhotoLimit: () => 5 }));
jest.mock('../useCameraAiProcessing', () => ({
  useCameraAiProcessing: () => ({ isBusy: () => false, abandon: mockAbandon }),
}));
const mockAbandon = jest.fn();
jest.mock('../useMealPhotoEstimate', () => ({
  useMealPhotoEstimate: () => mockEstimate,
}));
jest.mock('@/services/trackedMealLogging', () => ({ logTrackedMeal: jest.fn() }));
jest.mock('@/utils/file', () => ({
  copyImageToDocumentDirectory: jest.fn(),
  deleteFoodImage: jest.fn(),
}));

const review = {
  meal: { name: 'Plate', type: 'Meal', calories: 100, protein: 1, carbs: 2, fat: 3, grams: 50 },
  ingredients: [{ name: 'Rice', kcal: 100, protein: 1, carbs: 2, fat: 3, grams: 50 }],
  photoUri: 'file:///tmp/crop.jpg',
};
const when = {
  date: new Date(2026, 0, 1),
  time: new Date(2026, 0, 1, 12),
  mealType: 'lunch' as const,
  portionGrams: 50,
};

const render = () =>
  renderHook(({ visible }) => useMealCameraSession({ visible, cameraMode: 'ai-meal-photo' }), {
    initialProps: { visible: true },
  });

/** Takes a photo in the quick flow and lets the estimate answer with `review`. */
async function reviewing() {
  mockEstimate.mockImplementation(async ({ onEstimate }) => onEstimate(review));
  const hook = render();
  await act(async () => hook.result.current.takePhoto(review.photoUri));

  return hook;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFlow = 'quick';
  jest.mocked(copyImageToDocumentDirectory).mockResolvedValue('file:///documents/food.jpg');
  jest.mocked(logTrackedMeal).mockResolvedValue(undefined);
});

describe('the quick flow', () => {
  it('estimates each photo straight away and shows its review', async () => {
    const hook = await reviewing();

    expect(mockEstimate).toHaveBeenCalledWith(
      expect.objectContaining({ photos: [review.photoUri] })
    );
    expect(hook.result.current.review).toBe(review);
    expect(hook.result.current.isSheetVisible).toBe(false);
  });
});

describe('the detailed flow', () => {
  beforeEach(() => {
    mockFlow = 'detailed';
  });

  it('collects photos and estimates only from the sheet', async () => {
    const hook = render();
    await act(async () => hook.result.current.takePhoto('file:///a.jpg'));

    expect(mockEstimate).not.toHaveBeenCalled();
    expect(hook.result.current.isSheetVisible).toBe(true);
    expect(hook.result.current.draft.photos).toEqual(['file:///a.jpg']);

    act(() => hook.result.current.estimateDraft());

    expect(mockEstimate).toHaveBeenCalledWith(
      expect.objectContaining({ photos: ['file:///a.jpg'] })
    );
    expect(hook.result.current.isSheetVisible).toBe(false);
  });

  it('forgets the draft and abandons the request when the camera closes', async () => {
    const hook = render();
    await act(async () => hook.result.current.takePhoto('file:///a.jpg'));
    await act(async () => hook.rerender({ visible: false }));

    expect(mockAbandon).toHaveBeenCalled();
    expect(hook.result.current.draft.photos).toEqual([]);
    expect(hook.result.current.isSheetVisible).toBe(false);
  });
});

describe('logging the review', () => {
  it('saves the meal with a kept copy of its photo and ends the review', async () => {
    const hook = await reviewing();
    await act(async () => hook.result.current.logReview(when));

    expect(logTrackedMeal).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: review.ingredients,
        mealName: 'Plate',
        imageUrl: 'file:///documents/food.jpg',
      })
    );
    expect(deleteFoodImage).not.toHaveBeenCalled();
    expect(hook.result.current.review).toBeNull();
  });

  it('deletes the copied photo when the meal cannot be written, and keeps the review', async () => {
    jest.mocked(logTrackedMeal).mockRejectedValue(new Error('db'));
    const hook = await reviewing();

    await act(async () => {
      await expect(hook.result.current.logReview(when)).rejects.toThrow('db');
    });

    expect(deleteFoodImage).toHaveBeenCalledWith('file:///documents/food.jpg');
    expect(hook.result.current.review).toBe(review);
  });
});
