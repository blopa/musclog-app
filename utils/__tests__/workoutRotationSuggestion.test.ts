import { pickRotationSuggestion, ROTATION_LOOKBACK_DAYS } from '@/utils/workoutRotationSuggestion';

const DAY = 24 * 60 * 60 * 1000;
const today = new Date(2026, 9, 12).getTime();
const live = new Set(['push', 'pull', 'legs', 'old']);

describe('pickRotationSuggestion', () => {
  it('suggests the recently trained workout that has rested longest', () => {
    const logs = [
      { templateId: 'push', completedAt: today - 1 * DAY },
      { templateId: 'pull', completedAt: today - 2 * DAY },
      { templateId: 'legs', completedAt: today - 3 * DAY },
      { templateId: 'push', completedAt: today - 4 * DAY },
    ];
    expect(pickRotationSuggestion(logs, live, today)).toEqual({
      templateId: 'legs',
      lastCompletedAt: today - 3 * DAY,
    });
  });

  it('uses each workout’s most recent completion, not its oldest', () => {
    const logs = [
      { templateId: 'push', completedAt: today - 10 * DAY },
      { templateId: 'push', completedAt: today - 1 * DAY },
      { templateId: 'pull', completedAt: today - 2 * DAY },
    ];
    expect(pickRotationSuggestion(logs, live, today)?.templateId).toBe('pull');
  });

  it('ignores workouts outside the lookback window, archived ones and unfinished logs', () => {
    const logs = [
      { templateId: 'old', completedAt: today - (ROTATION_LOOKBACK_DAYS + 1) * DAY },
      { templateId: 'archived', completedAt: today - 5 * DAY },
      { templateId: 'legs', completedAt: null },
      { templateId: null, completedAt: today - 6 * DAY },
      { templateId: 'push', completedAt: today - 1 * DAY },
    ];
    expect(pickRotationSuggestion(logs, live, today)?.templateId).toBe('push');
  });

  it('suggests nothing once a workout was finished today', () => {
    const logs = [
      { templateId: 'push', completedAt: today + 2 * 60 * 60 * 1000 },
      { templateId: 'legs', completedAt: today - 3 * DAY },
    ];
    expect(pickRotationSuggestion(logs, live, today)).toBeNull();
  });

  it('suggests nothing without recent history', () => {
    expect(pickRotationSuggestion([], live, today)).toBeNull();
  });
});
