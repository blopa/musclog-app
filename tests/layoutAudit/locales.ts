import fs from 'fs';
import path from 'path';

/**
 * Locales for the layout audit. Translated text is the most common reason a layout that fits in
 * English breaks (Russian and Dutch run long), so a default run covers every bundled locale, not
 * just English. `pseudo` is an extra: English stretched by `applyPseudoLocale`.
 */

const LOCALES_DIR = path.resolve(process.cwd(), 'lang', 'locales');
const SOURCE_LOCALE_DIRECTORY = 'en-us';
const MIN_SIGNATURE_LENGTH = 8;

/** `ru-ru` → `ru-RU`, the tag Playwright and the app's language setting use. */
export function localeTag(directory: string): string {
  const [language, region] = directory.split('-');
  return region ? `${language}-${region.toUpperCase()}` : language;
}

/** `ru-RU` → `ru-ru`, the folder under `lang/locales`. */
export function localeDirectory(locale: string): string {
  return locale.toLowerCase();
}

export function bundledLocales(localesDir = LOCALES_DIR): string[] {
  return fs
    .readdirSync(localesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => localeTag(entry.name))
    .sort((a, b) => (a === 'en-US' ? -1 : b === 'en-US' ? 1 : a.localeCompare(b)));
}

/**
 * `MUSCLOG_LAYOUT_LOCALES`: a comma list of locale tags. `all` (the default) means every bundled
 * locale; `pseudo` adds the stretched-English pass. Duplicates are dropped, order is kept.
 */
export function resolveLocales(value: string | undefined, localesDir = LOCALES_DIR): string[] {
  const requested = (value ?? 'all')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const expanded = requested.flatMap((part) => (part === 'all' ? bundledLocales(localesDir) : [part]));
  return [...new Set(expanded)];
}

function flattenStrings(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') {
    into.push(value);
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((child) => flattenStrings(child, into));
  }

  return into;
}

function localeStrings(directory: string, localesDir: string): string[] {
  const folder = path.join(localesDir, directory);
  return fs
    .readdirSync(folder)
    .filter((file) => file.endsWith('.json') && file !== 'untranslated.json')
    .flatMap((file) => flattenStrings(JSON.parse(fs.readFileSync(path.join(folder, file), 'utf8'))));
}

/**
 * Strings that appear in this locale's copy but not in English: if one is on screen, the app is
 * rendering in this locale. Interpolated and multi-line strings are left out, since the page
 * shows them with values filled in. English has none, so it always passes.
 */
export function localeSignatures(locale: string, localesDir = LOCALES_DIR): string[] {
  const directory = localeDirectory(locale);
  if (directory === SOURCE_LOCALE_DIRECTORY || !fs.existsSync(path.join(localesDir, directory))) {
    return [];
  }

  const english = new Set(localeStrings(SOURCE_LOCALE_DIRECTORY, localesDir));
  return [
    ...new Set(
      localeStrings(directory, localesDir).filter(
        (text) =>
          text.length >= MIN_SIGNATURE_LENGTH &&
          !english.has(text) &&
          !text.includes('{{') &&
          !text.includes('\n')
      )
    ),
  ];
}

export function showsLocale(visibleText: string, signatures: string[]): boolean {
  return signatures.length === 0 || signatures.some((signature) => visibleText.includes(signature));
}
