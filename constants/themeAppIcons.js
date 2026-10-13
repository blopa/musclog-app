'use strict';

/**
 * The single answer to "which launcher icon belongs to which theme?"
 *
 * Plain CommonJS for the same reason as `theme.registry.js`: the config plugin
 * (`plugins/withThemeAppIcons.js`) runs in Node during prebuild and must derive
 * the native icon set from exactly the rules the app uses at runtime.
 *
 * The default icon is the one `app.json` configures, and it belongs to the
 * default dark theme. Every other theme ships as an alternate icon, named by
 * the PascalCase form of its theme id (`kinetic-light` -> `KineticLight`).
 * The `system` preference deliberately keeps the default icon: the OS can flip
 * light/dark while the app is not running, so the icon could never follow it.
 */
const { DEFAULT_THEME_BY_MODE, THEME_DEFINITIONS, THEME_IDS } = require('../theme.registry');

const DEFAULT_APP_ICON_THEME = DEFAULT_THEME_BY_MODE.dark;

const ALTERNATE_APP_ICON_THEME_IDS = Object.freeze(
  THEME_IDS.filter((themeId) => themeId !== DEFAULT_APP_ICON_THEME)
);

/** `kinetic-light` -> `KineticLight`; the name both native platforms key the icon by. */
function appIconName(themeId) {
  return themeId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/** Transparent artwork: the Android adaptive-icon foreground. */
function themeIconSourcePath(themeId) {
  return `./assets/theme-icons/icon-bg-${themeId}.png`;
}

/** The same artwork flattened onto the theme's surface: iOS icons may not be transparent. */
function themeIconOpaqueSourcePath(themeId) {
  return `./assets/theme-icons/opaque/icon-bg-${themeId}.png`;
}

/** The fill behind the artwork, on both the opaque iOS icon and the Android adaptive icon. */
function themeIconBackgroundColor(themeId) {
  return THEME_DEFINITIONS[themeId].palette.surfaceBase;
}

/**
 * The alternate icon a theme preference should show, or `null` for the default
 * icon. Unknown values fall back to the default rather than throwing, because
 * the preference is read from storage written by other app versions.
 */
function appIconNameForPreference(preference) {
  if (!ALTERNATE_APP_ICON_THEME_IDS.includes(preference)) {
    return null;
  }

  return appIconName(preference);
}

module.exports = {
  ALTERNATE_APP_ICON_THEME_IDS,
  DEFAULT_APP_ICON_THEME,
  appIconName,
  appIconNameForPreference,
  themeIconBackgroundColor,
  themeIconOpaqueSourcePath,
  themeIconSourcePath,
};
