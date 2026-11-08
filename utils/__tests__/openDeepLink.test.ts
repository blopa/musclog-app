import { redirectSystemPath } from '../../app/+native-intent';
import { isOnboardingCompleted } from '../onboardingService';
import { setPendingOpenLink, takePendingOpenLink } from '../openLinkInbox';

jest.mock('../onboardingService', () => ({ isOnboardingCompleted: jest.fn() }));

const PAYLOAD = '{"schema":"musclog-workout-plan"}';
const link = (kind: string, base = 'https://musclog.app/open') =>
  `${base}#${kind}=${encodeURIComponent(PAYLOAD)}`;

beforeEach(() => {
  jest.clearAllMocks();
  delete (global as any).__PENDING_WIDGET_ACTION;
  setPendingOpenLink(null);
  (isOnboardingCompleted as jest.Mock).mockResolvedValue(true);
});

describe('open links', () => {
  it.each([true, false])(
    'routes a workout link to the workouts screen (initial=%s)',
    async (initial) => {
      await expect(redirectSystemPath({ path: link('workout'), initial })).resolves.toBe(
        '/app/workout/workouts'
      );
    }
  );

  it.each([true, false])('routes a food link to the food diary (initial=%s)', async (initial) => {
    await expect(redirectSystemPath({ path: link('food'), initial })).resolves.toBe(
      '/app/nutrition/food'
    );
  });

  it('treats the custom-scheme twin the same way', async () => {
    await expect(
      redirectSystemPath({ path: link('food', 'com.werules.logger://open'), initial: true })
    ).resolves.toBe('/app/nutrition/food');
  });

  it('keeps the payload for the screen it routed to', async () => {
    await redirectSystemPath({ path: link('workout'), initial: true });

    expect(takePendingOpenLink('food')).toBeNull();
    expect(takePendingOpenLink('workout')).toEqual({ kind: 'workout', payload: PAYLOAD });
  });

  it.each([
    'https://musclog.app/open',
    'https://musclog.app/open#cycle=%7B%7D',
    'https://musclog.app/open#workout=',
  ])('only opens the app for %s', async (path) => {
    await expect(redirectSystemPath({ path, initial: true })).resolves.toBe('/app');
    expect(takePendingOpenLink('workout')).toBeNull();
    expect(takePendingOpenLink('food')).toBeNull();
  });

  it('stays inert, and drops the payload, before onboarding completes', async () => {
    (isOnboardingCompleted as jest.Mock).mockResolvedValue(false);

    await expect(redirectSystemPath({ path: link('workout'), initial: true })).resolves.toBeNull();
    expect(takePendingOpenLink('workout')).toBeNull();
  });

  it('never lets payload text reach the widget action branch', async () => {
    const path = `https://musclog.app/open#food=${encodeURIComponent('action=open-camera')}`;

    await expect(redirectSystemPath({ path, initial: true })).resolves.toBe('/app/nutrition/food');
    expect((global as any).__PENDING_WIDGET_ACTION).toBeUndefined();
    expect(takePendingOpenLink('food')).toEqual({ kind: 'food', payload: 'action=open-camera' });
  });

  it.each([
    'https://musclog.app/download#workout=1',
    'https://evil.example/open#workout=1',
    '/app/progress',
  ])('leaves %s alone', async (path) => {
    await expect(redirectSystemPath({ path, initial: true })).resolves.toBe(path);
    expect(takePendingOpenLink('workout')).toBeNull();
    expect(isOnboardingCompleted).not.toHaveBeenCalled();
  });
});
