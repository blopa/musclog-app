import { reloadApp, restoreReloadTarget } from '@/utils/app.web';

describe('restoreReloadTarget', () => {
  it('sends a restore started from onboarding to the app home', () => {
    expect(restoreReloadTarget('/app/onboarding/landing')).toBe('/app');
  });

  it('matches every onboarding route, not just the landing screen', () => {
    expect(restoreReloadTarget('/app/onboarding/quick-goals')).toBe('/app');
    expect(restoreReloadTarget('/app/onboarding')).toBe('/app');
  });

  it('reloads every other surface in place', () => {
    // The website progress page imports a dump only to draw its own charts; navigating a
    // visitor to /app would take them out of the website.
    expect(restoreReloadTarget('/progress')).toBeNull();
    expect(restoreReloadTarget('/app')).toBeNull();
    expect(restoreReloadTarget('/app/settings')).toBeNull();
  });

  it('does not match a route that merely contains the word', () => {
    expect(restoreReloadTarget('/app/reonboarding')).toBeNull();
    expect(restoreReloadTarget('/app/onboardingx/landing')).toBeNull();
  });

  it('prefixes the export base URL', () => {
    const previous = process.env.EXPO_BASE_URL;
    process.env.EXPO_BASE_URL = '/musclog';
    try {
      expect(restoreReloadTarget('/musclog/app/onboarding/landing')).toBe('/musclog/app');
    } finally {
      if (previous === undefined) {
        delete process.env.EXPO_BASE_URL;
      } else {
        process.env.EXPO_BASE_URL = previous;
      }
    }
  });
});

describe('reloadApp', () => {
  const originalWindow = (globalThis as any).window;

  function installWindow(pathname: string) {
    const replace = jest.fn();
    const reload = jest.fn();
    (globalThis as any).window = { location: { pathname, reload, replace } };
    return { reload, replace };
  }

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  it('replaces the onboarding URL instead of reloading it', async () => {
    const { reload, replace } = installWindow('/app/onboarding/landing');

    await reloadApp();

    expect(replace).toHaveBeenCalledWith('/app');
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads in place everywhere else', async () => {
    const { reload, replace } = installWindow('/app/settings');

    await reloadApp();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });
});
