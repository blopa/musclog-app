import { existsSync } from 'node:fs';
import path from 'node:path';

const repositoryRoot = path.resolve(__dirname, '../..');

const { DEFAULT_THEME_BY_MODE, THEME_IDS } = require('../../theme.registry') as {
  DEFAULT_THEME_BY_MODE: { dark: string; light: string };
  THEME_IDS: string[];
};
const {
  ALTERNATE_APP_ICON_THEME_IDS,
  DEFAULT_APP_ICON_THEME,
  appIconName,
  appIconNameForPreference,
  themeIconBackgroundColor,
  themeIconOpaqueSourcePath,
  themeIconSourcePath,
} = require('../themeAppIcons') as {
  ALTERNATE_APP_ICON_THEME_IDS: readonly string[];
  DEFAULT_APP_ICON_THEME: string;
  appIconName: (themeId: string) => string;
  appIconNameForPreference: (preference: string) => string | null;
  themeIconBackgroundColor: (themeId: string) => string;
  themeIconOpaqueSourcePath: (themeId: string) => string;
  themeIconSourcePath: (themeId: string) => string;
};
const appJson = require('../../app.json') as {
  expo: {
    icon: string;
    ios: { icon: string; backgroundColor: string };
    android: { adaptiveIcon: { foregroundImage: string; backgroundColor: string } };
    plugins: unknown[];
  };
};

describe('theme app icons', () => {
  it('ships the default dark theme as the default icon and every other theme as an alternate', () => {
    expect(DEFAULT_APP_ICON_THEME).toBe(DEFAULT_THEME_BY_MODE.dark);
    expect([...ALTERNATE_APP_ICON_THEME_IDS].sort()).toEqual(
      THEME_IDS.filter((id) => id !== DEFAULT_APP_ICON_THEME).sort()
    );
  });

  it('names an icon after its theme in PascalCase', () => {
    expect(appIconName('kinetic-light')).toBe('KineticLight');
  });

  it('keeps the default icon for the system preference, the default theme and unknown values', () => {
    expect(appIconNameForPreference('system')).toBeNull();
    expect(appIconNameForPreference(DEFAULT_APP_ICON_THEME)).toBeNull();
    expect(appIconNameForPreference('kinetic-from-the-future')).toBeNull();
    for (const themeId of ALTERNATE_APP_ICON_THEME_IDS) {
      expect(appIconNameForPreference(themeId)).toBe(appIconName(themeId));
    }
  });

  it('has both the transparent and the opaque artwork on disk for every theme', () => {
    for (const themeId of THEME_IDS) {
      expect(existsSync(path.join(repositoryRoot, themeIconSourcePath(themeId)))).toBe(true);
      expect(existsSync(path.join(repositoryRoot, themeIconOpaqueSourcePath(themeId)))).toBe(true);
    }
  });

  it('configures app.json with the same default icon the runtime treats as "no alternate"', () => {
    const { expo } = appJson;
    expect(expo.icon).toBe(themeIconSourcePath(DEFAULT_APP_ICON_THEME));
    expect(expo.ios.icon).toBe(themeIconOpaqueSourcePath(DEFAULT_APP_ICON_THEME));
    expect(expo.android.adaptiveIcon.foregroundImage).toBe(
      themeIconSourcePath(DEFAULT_APP_ICON_THEME)
    );
    expect(expo.android.adaptiveIcon.backgroundColor).toBe(
      themeIconBackgroundColor(DEFAULT_APP_ICON_THEME)
    );
    expect(expo.plugins).toContain('./plugins/withThemeAppIcons');
  });
});
