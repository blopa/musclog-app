/**
 * WHY THIS PLUGIN EXISTS
 *
 * Choosing a theme in the app also switches the launcher icon
 * (`services/themeAppIcon.ts` -> `modules/theme-app-icon`). Both platforms only
 * switch between icons that were compiled into the app, so this plugin builds
 * one alternate icon per theme, derived from `constants/themeAppIcons.js`:
 *
 * - iOS: an `AppIcon<Name>.appiconset` per alternate theme (from the opaque
 *   artwork: iOS rejects transparent icons) plus the build settings that make
 *   the asset catalog compile them as alternate icons.
 * - Android: an adaptive icon per alternate theme, and launcher
 *   `activity-alias` entries the native module enables one at a time.
 *
 * WHY NOT `expo-alternate-app-icons`
 *
 * Its Android module disables whichever component launched the current task —
 * `.MainActivity` itself whenever the default icon is showing. MainActivity
 * also owns the `com.werules.logger://` deep-link filter (both home-screen
 * widgets open through it) and the Health Connect permissions-rationale
 * filter, so switching icons would have broken all three. Here MainActivity
 * keeps every filter except MAIN/LAUNCHER and is never disabled; only the
 * `.LauncherIcon*` aliases are toggled, and the default icon has its own alias
 * (`.LauncherIconDefault`) rather than being "MainActivity enabled".
 */

const {
  AndroidConfig,
  withAndroidColors,
  withAndroidManifest,
  withDangerousMod,
  withXcodeProject,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const {
  ALTERNATE_APP_ICON_THEME_IDS,
  appIconName,
  themeIconBackgroundColor,
  themeIconOpaqueSourcePath,
  themeIconSourcePath,
} = require('../constants/themeAppIcons');

const MAIN_ACTIVITY = '.MainActivity';
/** Must match `ALIAS_PREFIX` in `ThemeAppIconModule.kt`. */
const LAUNCHER_ALIAS_PREFIX = '.LauncherIcon';
const DEFAULT_ICON_ALIAS_SUFFIX = 'Default';
/** Must match `ICON_SET_PREFIX` in `ThemeAppIconModule.swift`. */
const IOS_ICON_SET_PREFIX = 'AppIcon';
const IOS_ICON_SIZE = 1024;
const IOS_ICON_FILENAME = 'App-Icon-1024x1024@1x.png';

/** Adaptive-icon foreground layer sizes (108dp at each density), as Expo's own icon step writes. */
const ANDROID_FOREGROUND_SIZES = Object.freeze({
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
});

function launcherAliasName(iconName) {
  return `${LAUNCHER_ALIAS_PREFIX}${iconName ?? DEFAULT_ICON_ALIAS_SUFFIX}`;
}

function androidIconResourceName(themeId) {
  return `ic_launcher_${themeId.replace(/-/g, '_')}`;
}

function androidIconBackgroundColorName(themeId) {
  return `iconBackground${appIconName(themeId)}`;
}

function iosIconSetName(themeId) {
  return `${IOS_ICON_SET_PREFIX}${appIconName(themeId)}`;
}

function isLauncherIntentFilter(filter) {
  return (
    (filter.action ?? []).some((a) => a.$['android:name'] === 'android.intent.action.MAIN') &&
    (filter.category ?? []).some((c) => c.$['android:name'] === 'android.intent.category.LAUNCHER')
  );
}

function launcherAlias(name, { enabled, icon, roundIcon }) {
  return {
    $: {
      'android:name': name,
      'android:enabled': enabled ? 'true' : 'false',
      'android:exported': 'true',
      'android:icon': icon,
      'android:roundIcon': roundIcon,
      'android:targetActivity': MAIN_ACTIVITY,
    },
    'intent-filter': [
      {
        action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
      },
    ],
  };
}

/**
 * Moves the launcher entry point off MainActivity and onto one alias per icon.
 * Idempotent: aliases are replaced by name, so re-running prebuild on an
 * already-transformed manifest yields the same manifest.
 */
function applyLauncherAliases(application) {
  const mainActivity = (application.activity ?? []).find(
    (activity) => activity.$['android:name'] === MAIN_ACTIVITY
  );
  if (!mainActivity) {
    throw new Error(`withThemeAppIcons: ${MAIN_ACTIVITY} was not found in AndroidManifest.xml.`);
  }
  mainActivity['intent-filter'] = (mainActivity['intent-filter'] ?? []).filter(
    (filter) => !isLauncherIntentFilter(filter)
  );

  const aliases = [
    launcherAlias(launcherAliasName(null), {
      enabled: true,
      icon: '@mipmap/ic_launcher',
      roundIcon: '@mipmap/ic_launcher_round',
    }),
    ...ALTERNATE_APP_ICON_THEME_IDS.map((themeId) =>
      launcherAlias(launcherAliasName(appIconName(themeId)), {
        enabled: false,
        icon: `@mipmap/${androidIconResourceName(themeId)}`,
        roundIcon: `@mipmap/${androidIconResourceName(themeId)}_round`,
      })
    ),
  ];

  const ownNames = new Set(aliases.map((alias) => alias.$['android:name']));
  application['activity-alias'] = [
    ...(application['activity-alias'] ?? []).filter(
      (alias) =>
        !ownNames.has(alias.$['android:name']) &&
        !alias.$['android:name'].startsWith(LAUNCHER_ALIAS_PREFIX)
    ),
    ...aliases,
  ];

  return application;
}

function adaptiveIconXml(themeId) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">',
    `    <background android:drawable="@color/${androidIconBackgroundColorName(themeId)}"/>`,
    `    <foreground android:drawable="@mipmap/${androidIconResourceName(themeId)}_foreground"/>`,
    '</adaptive-icon>',
    '',
  ].join('\n');
}

function iosIconSetContents() {
  return `${JSON.stringify(
    {
      images: [
        {
          filename: IOS_ICON_FILENAME,
          idiom: 'universal',
          platform: 'ios',
          size: `${IOS_ICON_SIZE}x${IOS_ICON_SIZE}`,
        },
      ],
      info: { author: 'expo', version: 1 },
    },
    null,
    2
  )}\n`;
}

const withLauncherAliases = (config) =>
  withAndroidManifest(config, (config) => {
    applyLauncherAliases(AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults));
    return config;
  });

const withAndroidIconColors = (config) =>
  withAndroidColors(config, (config) => {
    for (const themeId of ALTERNATE_APP_ICON_THEME_IDS) {
      config.modResults = AndroidConfig.Colors.assignColorValue(config.modResults, {
        name: androidIconBackgroundColorName(themeId),
        value: themeIconBackgroundColor(themeId),
      });
    }
    return config;
  });

const withAndroidIconResources = (config) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      // Loaded lazily: reading app.json must not require the native image library.
      const sharp = require('sharp');
      const { projectRoot, platformProjectRoot } = config.modRequest;
      const resDirectory = path.join(platformProjectRoot, 'app', 'src', 'main', 'res');
      const anydpiDirectory = path.join(resDirectory, 'mipmap-anydpi-v26');
      await fs.promises.mkdir(anydpiDirectory, { recursive: true });

      for (const themeId of ALTERNATE_APP_ICON_THEME_IDS) {
        const resource = androidIconResourceName(themeId);
        const source = path.join(projectRoot, themeIconSourcePath(themeId));
        for (const [density, size] of Object.entries(ANDROID_FOREGROUND_SIZES)) {
          const directory = path.join(resDirectory, `mipmap-${density}`);
          await fs.promises.mkdir(directory, { recursive: true });
          await sharp(source)
            .resize(size, size)
            .png()
            .toFile(path.join(directory, `${resource}_foreground.png`));
        }
        const xml = adaptiveIconXml(themeId);
        await fs.promises.writeFile(path.join(anydpiDirectory, `${resource}.xml`), xml);
        await fs.promises.writeFile(path.join(anydpiDirectory, `${resource}_round.xml`), xml);
      }
      return config;
    },
  ]);

const withIosIconSets = (config) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const sharp = require('sharp');
      const { projectRoot, platformProjectRoot, projectName } = config.modRequest;
      const catalog = path.join(platformProjectRoot, projectName, 'Images.xcassets');

      for (const themeId of ALTERNATE_APP_ICON_THEME_IDS) {
        const directory = path.join(catalog, `${iosIconSetName(themeId)}.appiconset`);
        await fs.promises.mkdir(directory, { recursive: true });
        await sharp(path.join(projectRoot, themeIconOpaqueSourcePath(themeId)))
          .resize(IOS_ICON_SIZE, IOS_ICON_SIZE)
          .flatten({ background: themeIconBackgroundColor(themeId) })
          .png()
          .toFile(path.join(directory, IOS_ICON_FILENAME));
        await fs.promises.writeFile(path.join(directory, 'Contents.json'), iosIconSetContents());
      }
      return config;
    },
  ]);

const withIosAlternateIconBuildSettings = (config) =>
  withXcodeProject(config, (config) => {
    const names = ALTERNATE_APP_ICON_THEME_IDS.map(iosIconSetName).join(' ');
    const target = config.modRequest.projectName;
    config.modResults.updateBuildProperty(
      'ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES',
      `"${names}"`,
      undefined,
      target
    );
    config.modResults.updateBuildProperty(
      'ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS',
      'YES',
      undefined,
      target
    );
    return config;
  });

function withThemeAppIcons(config) {
  config = withLauncherAliases(config);
  config = withAndroidIconColors(config);
  config = withAndroidIconResources(config);
  config = withIosIconSets(config);
  config = withIosAlternateIconBuildSettings(config);
  return config;
}

module.exports = withThemeAppIcons;
module.exports.ANDROID_FOREGROUND_SIZES = ANDROID_FOREGROUND_SIZES;
module.exports.adaptiveIconXml = adaptiveIconXml;
module.exports.androidIconResourceName = androidIconResourceName;
module.exports.applyLauncherAliases = applyLauncherAliases;
module.exports.iosIconSetName = iosIconSetName;
module.exports.launcherAliasName = launcherAliasName;
