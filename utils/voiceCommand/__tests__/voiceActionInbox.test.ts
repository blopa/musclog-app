import {
  setPendingVoiceAction,
  subscribePendingVoiceAction,
  takePendingVoiceAction,
} from '@/utils/voiceCommand/voiceActionInbox';
import type { VoiceAction } from '@/utils/voiceCommand/types';

const ACTION: VoiceAction = {
  kind: 'searchFood',
  day: new Date(2026, 10, 26),
  mealType: 'lunch',
  query: 'rice',
};

describe('voiceActionInbox', () => {
  beforeEach(() => {
    setPendingVoiceAction(null);
  });

  it('gives the pending action once, then nothing', () => {
    setPendingVoiceAction(ACTION);

    expect(takePendingVoiceAction()).toBe(ACTION);
    expect(takePendingVoiceAction()).toBeNull();
  });

  it('notifies subscribers when an action is set', () => {
    const listener = jest.fn();
    const unsubscribe = subscribePendingVoiceAction(listener);

    setPendingVoiceAction(ACTION);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('stops notifying after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = subscribePendingVoiceAction(listener);
    unsubscribe();

    setPendingVoiceAction(ACTION);

    expect(listener).not.toHaveBeenCalled();
  });
});
