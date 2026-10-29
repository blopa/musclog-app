import AsyncStorage from '@react-native-async-storage/async-storage';

type Mirror = typeof import('@/utils/themeMirror');

const STORAGE_KEY = 'musclog_theme_mirror_native';

// The mirror keeps its snapshot at module scope, so each test loads a fresh copy.
function loadMirror(): Mirror {
  let mirror!: Mirror;
  jest.isolateModules(() => {
    mirror = require('@/utils/themeMirror');
  });

  return mirror;
}

describe('native theme mirror', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('has nothing to paint with until hydrated, then serves the stored preference', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ preference: 'kinetic-volt', themeId: 'kinetic-volt' })
    );
    const mirror = loadMirror();
    const listener = jest.fn();
    mirror.subscribeToThemeMirror(listener);

    expect(mirror.getThemeMirror()).toBeNull();

    await mirror.hydrateThemeMirror();

    expect(mirror.getThemeMirror()).toEqual({
      preference: 'kinetic-volt',
      themeId: 'kinetic-volt',
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reads storage once however many callers hydrate', async () => {
    const getItem = jest.spyOn(AsyncStorage, 'getItem');
    getItem.mockClear();
    const mirror = loadMirror();

    await Promise.all([mirror.hydrateThemeMirror(), mirror.hydrateThemeMirror()]);
    await mirror.hydrateThemeMirror();

    expect(getItem).toHaveBeenCalledTimes(1);
  });

  it('migrates a legacy dark/light preference and drops an unknown theme id', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ preference: 'light', themeId: 'no-such-theme' })
    );
    const mirror = loadMirror();

    await mirror.hydrateThemeMirror();

    expect(mirror.getThemeMirror()?.preference).toBe('kinetic-light');
    expect(mirror.getThemeMirror()?.themeId).toBeUndefined();
  });

  it('ignores a corrupt or empty entry instead of failing boot', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{not json');
    const corrupt = loadMirror();
    await expect(corrupt.hydrateThemeMirror()).resolves.toBeUndefined();
    expect(corrupt.getThemeMirror()).toBeNull();

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({}));
    const empty = loadMirror();
    await empty.hydrateThemeMirror();
    expect(empty.getThemeMirror()).toBeNull();
  });

  it('does not let a slow disk read overwrite a newer preference', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ preference: 'kinetic-volt', themeId: 'kinetic-volt' })
    );
    const mirror = loadMirror();

    const hydrating = mirror.hydrateThemeMirror();
    mirror.recordResolvedTheme('kinetic-shock', 'kinetic-shock');
    await hydrating;

    expect(mirror.getThemeMirror()?.preference).toBe('kinetic-shock');
  });

  it('persists the preference and id, without the web-only variable map', async () => {
    const mirror = loadMirror();

    mirror.recordResolvedTheme('kinetic-blush', 'kinetic-blush');
    await new Promise((resolve) => setImmediate(resolve));

    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '')).toEqual({
      preference: 'kinetic-blush',
      themeId: 'kinetic-blush',
    });
    // The web key is `localStorage` there; native must never write to it.
    expect(await AsyncStorage.getItem('musclog_theme')).toBeNull();
  });
});
