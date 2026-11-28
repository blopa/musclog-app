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

const NOTE: VoiceAction = { kind: 'addNote', body: 'bought oats' };

const DIARY = ['copyMeal', 'searchFood'] as const;

describe('voiceActionInbox', () => {
  beforeEach(() => {
    setPendingVoiceAction(null);
  });

  it('gives the pending action once, to a caller that performs its kind, then nothing', () => {
    setPendingVoiceAction(ACTION);

    expect(takePendingVoiceAction(DIARY)).toBe(ACTION);
    expect(takePendingVoiceAction(DIARY)).toBeNull();
  });

  it('keeps a pending action whose kind the caller does not perform', () => {
    setPendingVoiceAction(NOTE);

    expect(takePendingVoiceAction(DIARY)).toBeNull();
    expect(takePendingVoiceAction(['addNote'])).toBe(NOTE);
  });

  it('keeps the action pending after a refused take, so the right screen still gets it', () => {
    setPendingVoiceAction(ACTION);

    expect(takePendingVoiceAction(['addNote'])).toBeNull();
    expect(takePendingVoiceAction(['addNote', 'searchFood'])).toBe(ACTION);
  });

  it('returns null when nothing is pending, whatever the kinds', () => {
    expect(takePendingVoiceAction(DIARY)).toBeNull();
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
