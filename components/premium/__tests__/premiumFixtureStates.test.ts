import { PREMIUM_FIXTURE_STATES } from '@/components/premium/premiumFixtureStates';

describe('PREMIUM_FIXTURE_STATES', () => {
  const byId = (id: string) => {
    const state = PREMIUM_FIXTURE_STATES.find((candidate) => candidate.id === id);
    if (!state) {
      throw new Error(`no fixture state ${id}`);
    }

    return state.build();
  };

  it('lists the states in order (busy states appended)', () => {
    expect(PREMIUM_FIXTURE_STATES.map((state) => state.id)).toEqual([
      'loading',
      'not-subscribed',
      'active',
      'exhausted',
      'removed',
      'revoked',
      'at-capacity',
      'offline',
      'store-wait',
      'confirming',
      'confirming-slow',
      'resetting',
    ]);
  });

  it('gives every state a unique id and label, so every button is unique', () => {
    const labels = PREMIUM_FIXTURE_STATES.map((state) => `Open Premium Modal (${state.label})`);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(PREMIUM_FIXTURE_STATES.map((state) => state.id)).size).toBe(
      PREMIUM_FIXTURE_STATES.length
    );
  });

  it('builds the real view for each state', () => {
    expect(byId('loading').view.phase).toBe('loading');
    expect(byId('loading').view.notice).toBeNull();

    expect(byId('not-subscribed').view.phase).toBe('not_subscribed');
    expect(byId('not-subscribed').view.canSubscribe).toBe(true);

    expect(byId('active').view.phase).toBe('active');
    expect(byId('active').view.usedPct).toBe(40);
    expect(byId('active').view.resetsAt).toBe('2026-12-01T00:00:00.000Z');
    expect(byId('active').view.devices).toEqual({ count: 2, max: 3 });
    expect(byId('active').view.notice).toBeNull();

    expect(byId('exhausted').view.phase).toBe('exhausted');
    expect(byId('exhausted').view.notice).toBe('exhausted');

    expect(byId('removed').view.phase).toBe('removed');
    expect(byId('removed').view.notice).toBe('removed');

    expect(byId('revoked').view.phase).toBe('revoked');
    expect(byId('revoked').view.notice).toBe('revoked');

    expect(byId('at-capacity').view.phase).toBe('active');
    expect(byId('at-capacity').view.notice).toBe('at_capacity');

    expect(byId('offline').view.notice).toBe('offline');
  });

  it('shows the price where one is shown, and the no-op actions resolve', async () => {
    expect(byId('not-subscribed').priceString).toBe('€4.99');
    expect(byId('loading').priceString).toBeNull();
    await expect(byId('active').subscribe()).resolves.toBe(false);
    await expect(byId('active').restore()).resolves.toBe(false);
    expect(byId('active').consentNeeded(true)).toBe(false);
  });

  it('builds the busy states with the stage the modal shows', () => {
    expect(byId('store-wait').activity).toEqual({ kind: 'subscribe', stage: 'store' });
    expect(byId('confirming').activity?.stage).toBe('confirming');
    expect(byId('confirming-slow').activity).toEqual({ kind: 'restore', stage: 'slow' });
    expect(byId('resetting').activity?.kind).toBe('reset');
    expect(byId('confirming').busy).toBe(true);
    expect(byId('confirming').view.canSubscribe).toBe(true);
  });
});
