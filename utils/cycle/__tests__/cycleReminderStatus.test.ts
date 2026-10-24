import type { TFunction } from 'i18next';

import {
  cycleDeliveryState,
  cycleReminderPreviews,
  isDeliveryBlocked,
  reminderStatusKind,
} from '../cycleReminderStatus';

const granted = { permission: 'granted', appEnabled: true, cycleEnabled: true };

describe('cycleDeliveryState', () => {
  it('collapses platform, permission and switches into one answer', () => {
    expect(cycleDeliveryState(true, granted)).toBe('web');
    expect(cycleDeliveryState(false, null)).toBe('unknown');
    expect(cycleDeliveryState(false, { ...granted, permission: 'denied' })).toBe('noPermission');
    expect(cycleDeliveryState(false, { ...granted, cycleEnabled: false })).toBe('switchedOff');
    expect(cycleDeliveryState(false, { ...granted, appEnabled: false })).toBe('switchedOff');
    expect(cycleDeliveryState(false, granted)).toBe('ok');
  });

  it('only calls a known problem blocked: an unread status warns about nothing', () => {
    expect(isDeliveryBlocked('noPermission')).toBe(true);
    expect(isDeliveryBlocked('switchedOff')).toBe(true);
    expect(isDeliveryBlocked('unknown')).toBe(false);
    expect(isDeliveryBlocked('web')).toBe(false);
    expect(isDeliveryBlocked('ok')).toBe(false);
  });
});

describe('reminderStatusKind', () => {
  it('puts a delivery problem ahead of a pause, and a pause ahead of the next reminder', () => {
    expect(reminderStatusKind({ delivery: 'noPermission', paused: true, hasUpcoming: true })).toBe(
      'noPermission'
    );
    expect(reminderStatusKind({ delivery: 'ok', paused: true, hasUpcoming: true })).toBe('paused');
    expect(reminderStatusKind({ delivery: 'ok', paused: false, hasUpcoming: true })).toBe('next');
    expect(reminderStatusKind({ delivery: 'unknown', paused: false, hasUpcoming: false })).toBe(
      'none'
    );
    expect(reminderStatusKind({ delivery: 'web', paused: false, hasUpcoming: true })).toBe('web');
  });
});

describe('cycleReminderPreviews', () => {
  const t = ((key: string) => key) as unknown as TFunction;
  const base = { timeline: null, now: Date.UTC(2026, 9, 1), t, locale: 'en-US' };

  it('shows each distinct text once: in the private style every reminder reads the same', () => {
    const previews = cycleReminderPreviews({
      ...base,
      enabledKinds: ['period-start', 'daily-log', 'pill'],
      style: 'discreet',
    });
    expect(previews).toHaveLength(1);
  });

  it('falls back to the period heads-up as an example when nothing is on', () => {
    expect(cycleReminderPreviews({ ...base, enabledKinds: [], style: 'detailed' })).toHaveLength(1);
  });
});
