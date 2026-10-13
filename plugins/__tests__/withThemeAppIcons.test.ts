type ManifestNode = { $: Record<string, string>; [key: string]: unknown };
type IntentFilter = {
  action?: ManifestNode[];
  category?: ManifestNode[];
  data?: ManifestNode[];
};
type Application = {
  activity?: (ManifestNode & { 'intent-filter'?: IntentFilter[] })[];
  'activity-alias'?: (ManifestNode & { 'intent-filter'?: IntentFilter[] })[];
};

const { ALTERNATE_APP_ICON_THEME_IDS, appIconName } = require('../../constants/themeAppIcons') as {
  ALTERNATE_APP_ICON_THEME_IDS: readonly string[];
  appIconName: (themeId: string) => string;
};
const { adaptiveIconXml, androidIconResourceName, applyLauncherAliases, launcherAliasName } =
  require('../withThemeAppIcons') as {
    adaptiveIconXml: (themeId: string) => string;
    androidIconResourceName: (themeId: string) => string;
    applyLauncherAliases: (application: Application) => Application;
    launcherAliasName: (iconName: string | null) => string;
  };

const node = (name: string): ManifestNode => ({ $: { 'android:name': name } });

/** The parts of the generated AndroidManifest.xml the transform touches. */
function manifestApplication(): Application {
  return {
    activity: [
      {
        $: { 'android:name': '.MainActivity', 'android:exported': 'true' },
        'intent-filter': [
          {
            action: [node('android.intent.action.MAIN')],
            category: [node('android.intent.category.LAUNCHER')],
          },
          {
            action: [node('android.intent.action.VIEW')],
            category: [
              node('android.intent.category.DEFAULT'),
              node('android.intent.category.BROWSABLE'),
            ],
            data: [{ $: { 'android:scheme': 'com.werules.logger' } }],
          },
          { action: [node('androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE')] },
        ],
      },
    ],
    'activity-alias': [
      {
        $: {
          'android:name': 'ViewPermissionUsageActivity',
          'android:targetActivity': '.MainActivity',
        },
      },
    ],
  };
}

const isLauncher = (filter: IntentFilter) =>
  filter.category?.some((c) => c.$['android:name'] === 'android.intent.category.LAUNCHER');

describe('withThemeAppIcons', () => {
  it('moves the launcher entry off MainActivity but keeps its deep-link and Health Connect filters', () => {
    const application = applyLauncherAliases(manifestApplication());
    const filters = application.activity![0]['intent-filter']!;

    expect(filters.some(isLauncher)).toBe(false);
    expect(filters.map((filter) => filter.action![0].$['android:name'])).toEqual([
      'android.intent.action.VIEW',
      'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE',
    ]);
    // MainActivity itself is never disabled.
    expect(application.activity![0].$['android:enabled']).toBeUndefined();
  });

  it('declares exactly one enabled launcher alias, for the default icon', () => {
    const aliases = applyLauncherAliases(manifestApplication())['activity-alias']!;
    const launchers = aliases.filter((alias) => alias['intent-filter']?.some(isLauncher));

    expect(launchers.map((alias) => alias.$['android:name'])).toEqual([
      launcherAliasName(null),
      ...ALTERNATE_APP_ICON_THEME_IDS.map((id) => launcherAliasName(appIconName(id))),
    ]);
    expect(launchers.filter((alias) => alias.$['android:enabled'] === 'true')).toEqual([
      expect.objectContaining({
        $: expect.objectContaining({
          'android:name': '.LauncherIconDefault',
          'android:icon': '@mipmap/ic_launcher',
        }),
      }),
    ]);
    for (const alias of launchers) {
      expect(alias.$['android:targetActivity']).toBe('.MainActivity');
      expect(alias.$['android:exported']).toBe('true');
    }
    const light = launchers.find(
      (alias) => alias.$['android:name'] === '.LauncherIconKineticLight'
    );
    expect(light?.$['android:icon']).toBe('@mipmap/ic_launcher_kinetic_light');
    expect(light?.$['android:roundIcon']).toBe('@mipmap/ic_launcher_kinetic_light_round');
  });

  it('keeps unrelated aliases and is idempotent across prebuilds', () => {
    const once = applyLauncherAliases(manifestApplication());
    const twice = applyLauncherAliases(JSON.parse(JSON.stringify(once)));

    expect(twice).toEqual(once);
    expect(once['activity-alias']![0].$['android:name']).toBe('ViewPermissionUsageActivity');
  });

  it('drops launcher aliases of themes that no longer exist', () => {
    const application = manifestApplication();
    application['activity-alias']!.push({
      $: { 'android:name': '.LauncherIconKineticRetired', 'android:enabled': 'false' },
    });

    const names = applyLauncherAliases(application)['activity-alias']!.map(
      (alias) => alias.$['android:name']
    );
    expect(names).not.toContain('.LauncherIconKineticRetired');
  });

  it('builds the adaptive icon from the theme foreground over its own background color', () => {
    expect(androidIconResourceName('kinetic-light')).toBe('ic_launcher_kinetic_light');
    const xml = adaptiveIconXml('kinetic-light');
    expect(xml).toContain('@color/iconBackgroundKineticLight');
    expect(xml).toContain('@mipmap/ic_launcher_kinetic_light_foreground');
  });

  it('throws when MainActivity is missing rather than shipping an app with no launcher', () => {
    expect(() => applyLauncherAliases({ activity: [] })).toThrow('.MainActivity');
  });
});
