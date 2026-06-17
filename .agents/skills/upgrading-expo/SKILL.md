---
name: upgrading-expo
description: Guidelines for upgrading Expo SDK versions and fixing dependency issues
version: 1.0.0
license: MIT
---

## Step-by-Step Upgrade Process

1. Upgrade Expo and dependencies

```bash
npx expo install expo@latest
npx expo install --fix
```

2. Run diagnostics: `npx expo-doctor`

3. Clear caches and reinstall

```bash
npx expo export -p ios --clear
rm -rf node_modules .expo
watchman watch-del-all
```

## Beta/Preview Releases

Beta versions use `.preview` suffix (e.g., `55.0.0-preview.2`), published under `@next` tag.

Check if latest is beta: https://exp.host/--/api/v2/versions (look for `-preview` in `expoVersion`)

```bash
npx expo install expo@next --fix  # install beta
```

## Breaking Changes by SDK Version

- **SDK 54**: React 19 compatibility, React Compiler support
- **SDK 55**: Native tabs restructuring (`NativeTabs.Trigger.*`), migrate `expo-av` → `expo-audio` + `expo-video`
- **SDK 56**: Navigation library changes, migrate `@react-navigation/*` imports to `expo-router` entry points

## Breaking Changes Checklist

- Check for removed APIs in release notes
- Update import paths for moved modules
- Review native module changes requiring prebuild
- Test all camera, audio, and video features
- Verify navigation still works correctly

## Prebuild for Native Changes

**First check if `ios/` and `android/` directories exist in the project.** If neither directory exists, the project uses Continuous Native Generation (CNG) — skip prebuild entirely.

If upgrading requires native changes:

```bash
npx expo prebuild --clean
```

## Clear Caches for Bare Workflow

Only applies when `ios/` and/or `android/` directories exist:

- iOS: `cd ios && pod install --repo-update`
- iOS derived data: `npx expo run:ios --no-build-cache`
- Android: `cd android && ./gradlew clean`

## Housekeeping

- Review release notes at https://expo.dev/changelog
- SDK 54+: ensure `react-native-worklets` is installed (required for reanimated)
- SDK 54+: enable React Compiler via `"experiments": { "reactCompiler": true }` in app.json
- Delete `sdkVersion` from `app.json` — let Expo manage it automatically
- Remove implicit packages from `package.json`: `@babel/core`, `babel-preset-expo`, `expo-constants`
- If `babel.config.js` only contains `babel-preset-expo`, delete the file
- If `metro.config.js` only contains expo defaults, delete the file

## Deprecated Packages

| Old Package            | Replacement                                    |
| ---------------------- | ---------------------------------------------- |
| `expo-av`              | `expo-audio` and `expo-video`                  |
| `expo-permissions`     | Individual package permission APIs             |
| `@expo/vector-icons`   | `expo-symbols` (for SF Symbols)                |
| `AsyncStorage`         | `expo-sqlite/localStorage/install`             |
| `expo-app-loading`     | `expo-splash-screen`                           |
| `expo-linear-gradient` | `experimental_backgroundImage` + CSS gradients |

When migrating deprecated packages, update all code usage before removing the old package.

## expo.install.exclude

Check if `package.json` has excluded packages:

```json
{
  "expo": { "install": { "exclude": ["react-native-reanimated"] } }
}
```

Exclusions are often workarounds that may no longer be needed after upgrading. Review each one.

## Removing Patches

Check if there are outdated patches in the `patches/` directory. Remove them if no longer needed.

## PostCSS

- `autoprefixer` isn't needed in SDK 53+. Remove it from dependencies and `postcss.config.js`/`postcss.config.mjs`.
- Use `postcss.config.mjs` in SDK 53+.

## Metro

Remove redundant metro config options:

- `resolver.unstable_enablePackageExports` is enabled by default in SDK 53+
- `experimentalImportSupport` is enabled by default in SDK 54+
- `EXPO_USE_FAST_RESOLVER=1` is removed in SDK 54+
- cjs and mjs extensions are supported by default in SDK 50+
- Expo webpack is deprecated — migrate to Expo Router and Metro web

## Hermes Engine v1

Since SDK 55, opt-in via `useHermesV1: true` in the `expo-build-properties` config plugin for improved runtime performance.

## New Architecture

The new architecture is enabled by default. The `"newArchEnabled": true` field in app.json is no longer needed. Expo Go only supports the new architecture as of SDK 53+.
