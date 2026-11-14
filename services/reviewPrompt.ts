import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

import { REVIEW_PROMPT_STATE } from '@/constants/misc';
import { handleError } from '@/utils/handleError';
import {
  parseReviewPromptState,
  recordReviewMoment,
  type ReviewMoment,
} from '@/utils/reviewPrompt';

// Calls run one after another so two quick moments cannot read the same stored state.
let queue: Promise<void> = Promise.resolve();

async function record(_moment: ReviewMoment): Promise<void> {
  try {
    if (!(await StoreReview.isAvailableAsync())) {
      return;
    }

    const state = parseReviewPromptState(await AsyncStorage.getItem(REVIEW_PROMPT_STATE));
    const { next, shouldRequest } = recordReviewMoment(state, Date.now());
    await AsyncStorage.setItem(REVIEW_PROMPT_STATE, JSON.stringify(next));

    if (shouldRequest && (await StoreReview.hasAction())) {
      await StoreReview.requestReview();
    }
  } catch (e) {
    handleError(e, 'reviewPrompt');
  }
}

/** Counts a moment when the person just did something worth rating. Never throws. */
export function recordPositiveMoment(moment: ReviewMoment): Promise<void> {
  queue = queue.then(() => record(moment));

  return queue;
}
