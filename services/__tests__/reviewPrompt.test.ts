import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

import { REVIEW_PROMPT_STATE } from '@/constants/misc';
import { recordPositiveMoment } from '@/services/reviewPrompt';

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(),
  hasAction: jest.fn(),
  requestReview: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

const store = StoreReview as jest.Mocked<typeof StoreReview>;
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

let saved: string | null;

beforeEach(() => {
  jest.clearAllMocks();
  saved = null;
  store.isAvailableAsync.mockResolvedValue(true);
  store.hasAction.mockResolvedValue(true);
  store.requestReview.mockResolvedValue(undefined);
  storage.getItem.mockImplementation(async () => saved);
  storage.setItem.mockImplementation(async (_key, value) => {
    saved = value;
  });
});

describe('recordPositiveMoment', () => {
  it('does nothing when store review is unavailable', async () => {
    store.isAvailableAsync.mockResolvedValue(false);
    await recordPositiveMoment('workoutCompleted');
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(store.requestReview).not.toHaveBeenCalled();
  });

  it('writes the state before requesting on the third moment', async () => {
    await recordPositiveMoment('workoutCompleted');
    await recordPositiveMoment('weeklyReviewDecided');
    expect(store.requestReview).not.toHaveBeenCalled();
    storage.setItem.mockClear();
    await recordPositiveMoment('workoutCompleted');
    expect(store.requestReview).toHaveBeenCalledTimes(1);
    expect(storage.setItem.mock.invocationCallOrder[0]).toBeLessThan(
      store.requestReview.mock.invocationCallOrder[0]
    );
    expect(storage.setItem.mock.calls[0][0]).toBe(REVIEW_PROMPT_STATE);
    expect(JSON.parse(saved as string).requestCount).toBe(1);
  });

  it('still writes the state when the OS has no action', async () => {
    store.hasAction.mockResolvedValue(false);
    saved = JSON.stringify({ moments: 2, lastRequestedAt: null, requestCount: 0 });
    await recordPositiveMoment('workoutCompleted');
    expect(store.requestReview).not.toHaveBeenCalled();
    expect(JSON.parse(saved).requestCount).toBe(1);
  });

  it('swallows errors', async () => {
    storage.getItem.mockRejectedValue(new Error('boom'));
    await expect(recordPositiveMoment('workoutCompleted')).resolves.toBeUndefined();
  });

  it('counts two concurrent calls as two moments', async () => {
    await Promise.all([
      recordPositiveMoment('workoutCompleted'),
      recordPositiveMoment('workoutCompleted'),
    ]);
    expect(JSON.parse(saved as string).moments).toBe(2);
  });
});
