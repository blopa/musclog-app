import { redirectSystemPath } from '../../app/+native-intent';
import { isOnboardingCompleted } from '../onboardingService';

jest.mock('../onboardingService', () => ({ isOnboardingCompleted: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  delete (global as any).__PENDING_WIDGET_ACTION;
  (isOnboardingCompleted as jest.Mock).mockResolvedValue(true);
});

it.each([true, false])(
  'routes nutrition for initial=%s through the protected app layout',
  async (initial) => {
    await expect(
      redirectSystemPath({ path: 'com.werules.logger://?action=open-nutrition', initial })
    ).resolves.toBe('/app/nutrition/food');
    expect((global as any).__PENDING_WIDGET_ACTION).toBeUndefined();
  }
);

it.each([true, false])(
  'routes the cycle widget for initial=%s to the cycle screen, whose own lock gates it',
  async (initial) => {
    await expect(
      redirectSystemPath({ path: 'com.werules.logger://?action=open-cycle', initial })
    ).resolves.toBe('/app/cycle');
    expect((global as any).__PENDING_WIDGET_ACTION).toBeUndefined();
  }
);

it('defers a cold camera launch until the app navigator is mounted', async () => {
  await expect(redirectSystemPath({ path: '/?action=open-camera', initial: true })).resolves.toBe(
    '/app'
  );
  expect((global as any).__PENDING_WIDGET_ACTION).toBe('open-camera');
});

it('preserves a warm camera intent for the existing Linking listener', async () => {
  const path = '/?action=open-camera';
  await expect(redirectSystemPath({ path, initial: false })).resolves.toBe(path);
  expect((global as any).__PENDING_WIDGET_ACTION).toBeUndefined();
});

it.each(['open-nutrition', 'open-camera', 'open-cycle'])(
  'keeps %s inert before onboarding completes',
  async (action) => {
    (isOnboardingCompleted as jest.Mock).mockResolvedValue(false);
    await expect(
      redirectSystemPath({ path: `/?action=${action}`, initial: true })
    ).resolves.toBeNull();
    expect((global as any).__PENDING_WIDGET_ACTION).toBeUndefined();
  }
);

it('leaves an ordinary app route intact', async () => {
  const path = '/app/progress';
  await expect(redirectSystemPath({ path, initial: true })).resolves.toBe(path);
  expect(isOnboardingCompleted).not.toHaveBeenCalled();
});
