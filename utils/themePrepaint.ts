import type { ThemeMirror } from '@/utils/themeMirror';

/**
 * Publishes the palette on `:root` before the body renders. `app/+html.tsx` inlines it as a
 * blocking script through `.toString()`, so the body must stay self-contained: no imports, no
 * module-level helpers, nothing but its arguments and browser globals.
 *
 * Every themed colour on the site resolves through a `--c-*` custom property, so applying the
 * right map here is what keeps the first paint from showing the wrong palette. A returning
 * visitor's exact palette comes from the theme mirror (`utils/themeMirror`); a first visit, or a
 * `system` preference, follows the OS scheme (what `resolveThemeId` does for `system`, and fresher
 * than the palette recorded under it when the phone changed scheme since the last visit).
 *
 * This is the ONLY place the palette reaches a statically served page before the bundle hydrates,
 * which on a phone can be many seconds: `ThemeProvider` puts nothing inline on web and skips its
 * hydration render, so nothing rendered can overrule it. Storage is read in its own `try`, so a
 * browser that blocks it still gets the OS default rather than no palette at all.
 *
 * It also names the theme on `<html data-theme-id>`, which is what the stylesheet that picks the
 * Loggy image for a theme (`websiteLoggyCss`) selects on: an image cannot read custom properties,
 * and swapping it after hydration would flash the default green first. `ThemeProvider` keeps the
 * attribute current when the theme changes.
 */
export function themePrepainter(
  storageKey: string,
  fallbacks: { dark: Record<string, string>; light: Record<string, string> },
  fallbackIds: { dark: string; light: string }
) {
  let mirrored: ThemeMirror | null = null;
  try {
    const raw = localStorage.getItem(storageKey);
    mirrored = raw ? (JSON.parse(raw) as ThemeMirror) : null;
  } catch {}

  try {
    const mode =
      typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
    const exact =
      mirrored && mirrored.preference !== 'system' && mirrored.variables && mirrored.themeId
        ? mirrored
        : null;
    const variables = exact ? (exact.variables as Record<string, string>) : fallbacks[mode];
    const themeId = exact ? (exact.themeId as string) : fallbackIds[mode];

    for (const name of Object.keys(variables)) {
      document.documentElement.style.setProperty(name, variables[name]);
    }

    document.documentElement.setAttribute('data-theme-id', themeId);
  } catch {}
}
