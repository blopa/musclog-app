# NativeWind → Uniwind Migration Plan

## Overview

Migrating from NativeWind 4.2.3 + Tailwind CSS 3.4.19 to Uniwind + Tailwind CSS 4.

**Scope**: 247 files use `className=`, totalling ~3,679 occurrences. The good news: most of these require **zero changes** — the Tailwind utility class names are the same. The work is entirely in configuration and the custom theme color tokens.

**Key findings from the codebase**:

- No NativeWind `vars()` usage — theme is managed via `useThemeContext()` + inline `style=` props
- No `cssInterop` usage
- No NativeWind `ThemeProvider` — the app has its own custom one in `context/ThemeContext.tsx`
- No `dark:` className variants used (only 3 files use `useColorScheme`, and not for className dark variants)
- `tailwind.config.js` has a large custom color palette (`bg-bg-*`, `text-text-*`, `accent-*`, `border-*`) that must be migrated to CSS `@theme`
- No `tailwind-merge` / `cn` utility currently exists

---

## Pre-migration Checklist

- [ ] Ensure you're on a clean git branch
- [ ] Read the [Uniwind quickstart](https://docs.uniwind.dev/quickstart) and [migration guide](https://docs.uniwind.dev/migration-from-nativewind) before starting
- [ ] Decide on a `rem` value: NativeWind defaults to 14px, Uniwind defaults to 16px. Most spacing/text in this app uses inline styles or explicit sizes, so 16px is likely fine — but verify visually

---

## Step 1 — Install Uniwind, Upgrade Tailwind v4

```bash
# Remove NativeWind
npm uninstall nativewind react-native-css-interop

# Install Uniwind + Tailwind v4
npm install uniwind
npm install --save-dev tailwindcss@next  # Tailwind v4
```

> Tailwind v4 is a significant release: it drops the JS config file in favour of CSS-first configuration via `@theme`. See the [Tailwind v4 upgrade guide](https://tailwindcss.com/docs/v4-beta) for full details.

---

## Step 2 — Update `babel.config.js`

Remove the NativeWind preset and the `jsxImportSource` option.

**Before** (`babel.config.js:32`):

```js
presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
```

**After**:

```js
presets: ['babel-preset-expo'],
```

The `react-native-reanimated/plugin` and decorator plugins stay as-is.

---

## Step 3 — Update `metro.config.js`

Replace `withNativeWind` with Uniwind's equivalent.

**Before** (`metro.config.js:3,18`):

```js
const { withNativeWind } = require('nativewind/metro');
// ...
module.exports = withNativeWind(config, { input: './global.css' });
```

**After**:

```js
const { withUniwindConfig } = require('uniwind/metro');
// ...
module.exports = withUniwindConfig(config, { cssEntryFile: './global.css' });
```

Note: `cssEntryFile` takes a **relative path** (unlike NativeWind's `input`). The existing Sentry config wrapper and the `sharp` stub resolver are unaffected.

Optional — to keep NativeWind's 14px rem default:

```js
module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  polyfills: { rem: 14 },
});
```

---

## Step 4 — Update `global.css`

Replace the `@tailwind` directives with Tailwind v4 / Uniwind imports, then migrate the entire `tailwind.config.js` color theme into CSS `@theme`.

**Before** (`global.css`):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**After**:

```css
@import 'tailwindcss';
@import 'uniwind';

@theme {
  /* Custom animation */
  --animate-spin-slow: spin-slow 2s linear infinite;

  /* Background colors */
  --color-bg-primary: <darkTheme.colors.background.primary>;
  --color-bg-secondary: <darkTheme.colors.background.secondary>;
  --color-bg-tertiary: <darkTheme.colors.background.tertiary>;
  --color-bg-card: <darkTheme.colors.background.card>;
  --color-bg-card-elevated: <darkTheme.colors.background.cardElevated>;
  --color-bg-card-dark: <darkTheme.colors.background.secondaryDark>;
  --color-bg-nav-bar: <darkTheme.colors.background.secondary>;
  --color-bg-nav-active: <darkTheme.colors.background.secondaryDark>;
  --color-bg-screen: <darkTheme.colors.background.primary>;
  --color-bg-overlay: <darkTheme.colors.background.overlay>;
  --color-bg-filter-tab: <darkTheme.colors.background.filterTab>;

  /* Text colors */
  --color-text-primary: <darkTheme.colors.text.primary>;
  --color-text-secondary: <darkTheme.colors.text.secondary>;
  --color-text-tertiary: <darkTheme.colors.text.tertiary>;
  --color-text-muted: <darkTheme.colors.text.muted>;
  --color-text-accent: <darkTheme.colors.text.accent>;
  --color-text-accent-light: <darkTheme.colors.text.accentLight>;
  --color-text-black: <darkTheme.colors.text.black>;
  --color-text-on-colorful: <darkTheme.colors.text.onColorful>;

  /* Accent colors */
  --color-accent-primary: <darkTheme.colors.accent.primary>;
  --color-accent-secondary: <darkTheme.colors.accent.secondary>;
  --color-accent-tertiary: <darkTheme.colors.accent.tertiary>;

  /* Border colors */
  --color-border-default: <darkTheme.colors.border.default>;
  --color-border-light: <darkTheme.colors.border.light>;
  --color-border-dark: <darkTheme.colors.border.dark>;
  --color-border-accent: <darkTheme.colors.border.accent>;
  --color-border-dashed: <darkTheme.colors.border.dashed>;
}

@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Remove input outline on web for focused inputs */
input:focus,
textarea:focus {
  outline: none;
}
```

> Replace the `<darkTheme.colors.*>` placeholders with the actual hex values from `theme.ts`. Run the existing `find-colors.js` script or read `theme.ts` directly — the dark theme palette is the `kineticDepth` object.

**Important**: In Tailwind v4, CSS variable names for colors use `--color-{name}`. The class `bg-bg-primary` maps to `--color-bg-primary`. The nested dot notation (`bg.primary`) becomes a hyphen (`bg-primary`). **All existing `className` usages should remain valid** as long as the CSS variable names match the old JS key paths.

---

## Step 5 — Delete `tailwind.config.js`

Once colors are in `global.css`, this file is no longer needed. Delete it.

```bash
rm tailwind.config.js
```

---

## Step 6 — Delete `nativewind-env.d.ts`

This file only references NativeWind types. Uniwind provides its own. Delete it.

```bash
rm nativewind-env.d.ts
```

Check if Uniwind requires a type reference file in its quickstart and add it if needed (likely `/// <reference types="uniwind/types" />`).

---

## Step 7 — Add `tailwind-merge` for className deduplication

Unlike NativeWind, Uniwind does **not** auto-deduplicate conflicting className strings (e.g. `"bg-red-500 bg-blue-500"`). This is only an issue where classNames are composed dynamically.

```bash
npm install tailwind-merge
```

Create a `utils/cn.ts` utility:

```ts
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(inputs.filter(Boolean).join(' '));
}
```

Scan for dynamic className composition patterns — places that concatenate or conditionally apply class strings — and update them to use `cn()`. A grep for `className={\`\``or`className={[` will find most candidates.

---

## Step 8 — Handle Safe Area Utilities (if used)

If any component uses `p-safe`, `pt-safe`, etc. (NativeWind's safe area class support), you need to wire up Uniwind's inset listener. Search for these patterns:

```bash
grep -r "p-safe\|pt-safe\|pb-safe\|pl-safe\|pr-safe" app/ components/
```

If found, update the root layout (`app/_layout.tsx`) to call `Uniwind.updateInsets` via `SafeAreaListener`. This app appears to use `react-native-safe-area-context` directly — check if className-based safe area utilities are used at all.

---

## Step 9 — Update `prettier-plugin-tailwindcss`

Tailwind v4 requires `prettier-plugin-tailwindcss` v0.7+. The project already has `0.7.2` so this should be compatible, but verify by running:

```bash
npm run format
```

The plugin may need a config update to point at the CSS entry file instead of `tailwind.config.js`.

---

## Step 10 — Verify and Test

1. **Clear Metro cache**: `npm run start-clear`
2. **Android**: `npm run android` — visually check all screens, especially components with custom color classes (`bg-bg-primary`, `text-text-primary`, etc.)
3. **Web**: `npm run web` — verify layout renders correctly at 390×844 viewport
4. **Lint**: `npm run lint:all`
5. **Tests**: `npm test`
6. **Pay special attention to**:
   - Navigation bar (`components/NavigationMenu.tsx`) — 34 className occurrences
   - Modal components — high className density
   - `components/theme/` — foundational components used everywhere
   - Onboarding screens — many className occurrences

---

## Risks and Known Complexity

| Area                          | Risk       | Notes                                                                                 |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| Tailwind v3 → v4 syntax       | Medium     | Class names are largely the same; main change is config format                        |
| Custom color tokens           | Medium     | 5 groups × ~10 colors = ~50 CSS variables to migrate manually                         |
| `darkMode: 'class'` removal   | Low        | `dark:` classNames are not used in this codebase                                      |
| rem value change (14 → 16)    | Low-Medium | App primarily uses inline styles; visually test spacing-heavy screens                 |
| No `tailwind-merge`           | Low        | Dynamic className composition is not heavy in this codebase                           |
| Web platform                  | Low        | Web uses `.web.tsx` overrides; Tailwind v4 CSS-first approach may improve web support |
| `prettier-plugin-tailwindcss` | Low        | Already on a compatible version                                                       |

---

## What Does NOT Need to Change

- All `className="..."` string literals — Tailwind utility class names are unchanged in v4
- `context/ThemeContext.tsx` — it's a custom context, not NativeWind's
- All `style={{ ... }}` inline styles — unrelated to NativeWind/Uniwind
- `hooks/useTheme.ts`, `theme.ts` — the app's own theme system, independent
- Any `import` of NativeWind beyond `nativewind/babel`, `nativewind/metro`, and `nativewind/preset` — there are none

---

## Estimated Effort

| Task                          | Effort                                                       |
| ----------------------------- | ------------------------------------------------------------ |
| Steps 1–3 (install + config)  | ~30 min                                                      |
| Step 4 (CSS theme migration)  | ~1–2 hours (manually resolve ~50 color values from theme.ts) |
| Steps 5–7 (cleanup + cn util) | ~30 min                                                      |
| Step 8 (safe area, if needed) | ~15 min                                                      |
| Step 10 (testing + visual QA) | ~2–4 hours                                                   |

---

## References

- [Uniwind Migration from NativeWind](https://docs.uniwind.dev/migration-from-nativewind)
- [Uniwind Quickstart](https://docs.uniwind.dev/quickstart)
- [Tailwind CSS v4 Upgrade Guide](https://tailwindcss.com/docs/v4-beta)
- [Introducing Uniwind (React Native Crossroads)](https://www.reactnativecrossroads.com/posts/introducing-uniwind-the-fastest-tailwind-bindings-for-react-native/)
