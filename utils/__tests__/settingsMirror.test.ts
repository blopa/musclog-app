import AsyncStorage from '@react-native-async-storage/async-storage';

import { SETTINGS_MIRROR_STORAGE_KEY } from '@/constants/misc';
import type { MirroredSettings } from '@/utils/settingsMirror';

type Mirror = typeof import('@/utils/settingsMirror');

const STORED: MirroredSettings = {
  theme: 'kinetic-volt',
  language: 'pt-BR',
  units: 'imperial',
  appLockScopesRaw: 'cycle',
};

// The mirror keeps its snapshot at module scope, so each test loads a fresh copy.
function loadMirror(): Mirror {
  let mirror!: Mirror;
  jest.isolateModules(() => {
    mirror = require('@/utils/settingsMirror');
  });

  return mirror;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('settings mirror', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('has nothing until hydrated, then serves the stored settings', async () => {
    await AsyncStorage.setItem(SETTINGS_MIRROR_STORAGE_KEY, JSON.stringify(STORED));
    const mirror = loadMirror();
    const listener = jest.fn();
    mirror.subscribeToSettingsMirror(listener);

    expect(mirror.getSettingsMirror()).toBeNull();

    await mirror.hydrateSettingsMirror();

    expect(mirror.getSettingsMirror()).toEqual(STORED);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reads storage once however many callers hydrate', async () => {
    const getItem = jest.spyOn(AsyncStorage, 'getItem');
    getItem.mockClear();
    const mirror = loadMirror();

    await Promise.all([mirror.hydrateSettingsMirror(), mirror.hydrateSettingsMirror()]);
    await mirror.hydrateSettingsMirror();

    expect(getItem).toHaveBeenCalledTimes(1);
  });

  it('migrates a legacy dark/light theme value', async () => {
    await AsyncStorage.setItem(
      SETTINGS_MIRROR_STORAGE_KEY,
      JSON.stringify({ ...STORED, theme: 'light' })
    );
    const mirror = loadMirror();

    await mirror.hydrateSettingsMirror();

    expect(mirror.getSettingsMirror()?.theme).toBe('kinetic-light');
  });

  // A partial mirror must not count as one: SettingsProvider treats any mirror as knowing the
  // lock scopes, so a copy missing them would read as "no lock".
  it.each([
    ['corrupt JSON', '{not json'],
    ['missing lock scopes', JSON.stringify({ ...STORED, appLockScopesRaw: undefined })],
    ['unknown units', JSON.stringify({ ...STORED, units: 'furlongs' })],
    ['empty language', JSON.stringify({ ...STORED, language: '' })],
  ])('ignores a mirror with %s instead of failing boot', async (_label, raw) => {
    await AsyncStorage.setItem(SETTINGS_MIRROR_STORAGE_KEY, raw);
    const mirror = loadMirror();

    await expect(mirror.hydrateSettingsMirror()).resolves.toBeUndefined();
    expect(mirror.getSettingsMirror()).toBeNull();
  });

  it('does not let a slow disk read overwrite newer settings', async () => {
    await AsyncStorage.setItem(SETTINGS_MIRROR_STORAGE_KEY, JSON.stringify(STORED));
    const mirror = loadMirror();
    const newer = { ...STORED, theme: 'kinetic-shock' as const, appLockScopesRaw: 'app' };

    const hydrating = mirror.hydrateSettingsMirror();
    mirror.recordSettingsMirror(newer);
    await hydrating;

    expect(mirror.getSettingsMirror()).toEqual(newer);
  });

  it('persists recorded settings and skips writes that change nothing', async () => {
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    setItem.mockClear();
    const mirror = loadMirror();

    mirror.recordSettingsMirror(STORED);
    mirror.recordSettingsMirror({ ...STORED });
    await flush();

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_MIRROR_STORAGE_KEY)) ?? '')).toEqual(
      STORED
    );
  });
});
