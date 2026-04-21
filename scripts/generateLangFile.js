#!/usr/bin/env node
/* eslint-disable no-undef */
/* eslint-env node */
const { ESLint } = require('eslint');
const fs = require('fs');
const path = require('path');
const prettier = require('prettier');

const eslintBaseConfig = require('../eslint.config.js');

const DIRNAME = __dirname;
const localesDir = path.join(DIRNAME, '..', 'lang', 'locales');
const untranslatedJsonPath = path.join(localesDir, 'untranslated.json');
const outputFilePath = path.join(DIRNAME, '..', 'lang', 'lang.ts');
const dateFnsLocalePath = path.join(DIRNAME, '..', 'node_modules', 'date-fns', 'locale.d.ts');
const dataDir = path.join(DIRNAME, '..', 'data');

// en-us → EN_US
function dirToConstantName(dir) {
  return dir.toUpperCase().replace(/-/g, '_');
}

// en-us → en-US (BCP 47)
function dirToLanguageTag(dir) {
  const [lang, region] = dir.split('-');
  return `${lang}-${region.toUpperCase()}`;
}

// en-us → enUs (JS variable prefix for JSON imports)
function dirToVarPrefix(dir) {
  const [lang, region] = dir.split('-');
  return lang + region.charAt(0).toUpperCase() + region.slice(1);
}

// date-fns locale key (e.g. "ru", "en-US", "pt-BR") → JS export name (ru, enUS, ptBR)
function dateFnsLocaleKeyToVarName(localeKey) {
  const parts = localeKey.split('-');
  if (parts.length === 1) {
    return parts[0];
  }

  return (
    parts[0] +
    parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('')
  );
}

// access_token → AccessToken, addMeal → AddMeal, food_food_portions → FoodFoodPortions
function fileNameToSuffix(baseName) {
  return baseName
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function defaultUntranslatedLabel(dir) {
  const tag = dirToLanguageTag(dir);
  try {
    // Resolve the name *in* that locale so labels match the language (e.g. русский for ru-RU).
    const dn = new Intl.DisplayNames([tag], { type: 'language' });
    return dn.of(tag) ?? tag;
  } catch {
    return tag;
  }
}

function capitalizeLanguageLabel(label) {
  const s = label.trim();
  if (!s) {
    return s;
  }
  return s[0].toLocaleUpperCase() + s.slice(1);
}

/** Keeps `untranslated.json` in sync with locale subdirs; preserves existing non-empty labels. */
function getExerciseFiles() {
  try {
    return fs
      .readdirSync(dataDir)
      .filter(
        (f) => f.startsWith('exercises') && f.endsWith('.json') && f !== 'exercisesData.json'
      )
      .sort();
  } catch {
    return [];
  }
}

function writeUntranslatedJson(langDirs) {
  let existing = {};
  try {
    const raw = fs.readFileSync(untranslatedJsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.untranslated === 'object' && parsed.untranslated !== null) {
      existing = parsed.untranslated;
    }
  } catch {
    // missing or invalid
  }

  const untranslated = {};
  for (const dir of langDirs) {
    const prev = existing[dir];
    const raw =
      typeof prev === 'string' && prev.trim() !== '' ? prev : defaultUntranslatedLabel(dir);
    untranslated[dir] = {
      name: capitalizeLanguageLabel(raw),
    };
  }

  const out = `${JSON.stringify({ untranslated }, null, 2)}\n`;
  fs.writeFileSync(untranslatedJsonPath, out, 'utf8');
  console.log(`Generated ${untranslatedJsonPath}`);
}

function getDateFnsLocales(callback) {
  fs.readFile(dateFnsLocalePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading date-fns locale definitions:', err);
      return;
    }

    const localeExports = {};
    const regex = /export \* from "\.\/locale\/([a-zA-Z-]+)\.js";/g;
    let match;

    while ((match = regex.exec(data)) !== null) {
      localeExports[match[1]] = match[1];
    }

    callback(localeExports);
  });
}

// Expansion factors relative to English, sourced from IBM Globalization Design Guide.
// Keys are BCP 47 base language codes. English (en) is the baseline at 1.0.
const IBM_EXPANSION_TABLE = {
  en: 1.0,
  ar: 0.8,
  da: 1.05,
  de: 1.3,
  es: 1.25,
  fi: 1.1,
  fr: 1.28,
  he: 0.8,
  it: 1.18,
  ja: 0.55,
  ko: 0.65,
  nl: 1.22,
  no: 1.05,
  pl: 1.2,
  pt: 1.2,
  ru: 0.95,
  sv: 1.05,
  th: 1.0,
  tr: 1.2,
  vi: 1.15,
  zh: 0.55,
};

// Scan locales dir for language subdirectories, sorted (en-us first alphabetically)
fs.readdir(localesDir, { withFileTypes: true }, (err, entries) => {
  if (err) {
    console.error('Error reading locales directory:', err);
    return;
  }

  const langDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  if (langDirs.length === 0) {
    console.error('No language directories found in', localesDir);
    return;
  }

  getDateFnsLocales((dateFnsLocales) => {
    writeUntranslatedJson(langDirs);

    // Get exercise files
    const exerciseFiles = getExerciseFiles();

    // For each language, collect its JSON files
    const languages = langDirs.map((dir) => {
      const dirPath = path.join(localesDir, dir);
      const files = fs
        .readdirSync(dirPath)
        .filter((f) => f.endsWith('.json'))
        .sort();

      // Resolve date-fns locale for this language
      let dateFnsLocaleName = null;
      const candidates = [
        dir, // en-us
        dirToLanguageTag(dir).replace('-', '-'), // en-US (same as dirToLanguageTag)
        dir.split('-')[0], // en
      ];

      for (const candidate of candidates) {
        if (dateFnsLocales[candidate]) {
          dateFnsLocaleName = candidate;
          break;
        }
        // Also try uppercase region: pt-BR
        const upperCandidate = dirToLanguageTag(dir);
        if (dateFnsLocales[upperCandidate]) {
          dateFnsLocaleName = upperCandidate;
          break;
        }
      }

      return { dir, files, dateFnsLocaleName };
    });

    // Build the output sections
    const constantName = (lang) => dirToConstantName(lang.dir);
    const varPrefix = (lang) => dirToVarPrefix(lang.dir);

    // date-fns imports (one per language that has a matching locale)
    const dateFnsImportNames = languages
      .filter((l) => l.dateFnsLocaleName)
      .map((l) => {
        const dfVar = dateFnsLocaleKeyToVarName(l.dateFnsLocaleName);
        return `${dfVar} as locale${dfVar.charAt(0).toUpperCase() + dfVar.slice(1)}`;
      });

    // JSON import blocks per language
    const jsonImportBlocks = languages.map((lang) => {
      const prefix = varPrefix(lang);
      const lines = lang.files.map((file) => {
        const baseName = path.basename(file, '.json');
        const suffix = fileNameToSuffix(baseName);
        return `import ${prefix}${suffix} from './locales/${lang.dir}/${file}';`;
      });

      const prefix_blank = languages.indexOf(lang) > 0 ? '\n' : '';
      return `${prefix_blank}// ${lang.dir}\n${lines.join('\n')}`;
    });

    // Exercise imports
    const exerciseImports = exerciseFiles.map((file) => {
      const baseName = path.basename(file, '.json');
      // Convert exercisesEnUS -> exercisesEnUs (matching the pattern from dirToVarPrefix)
      const varName = baseName.replace(
        /exercises([A-Z][a-z]+)([A-Z][A-Za-z]*)/,
        (match, lang, region) => {
          return `exercises${lang}${region.charAt(0).toUpperCase() + region.slice(1).toLowerCase()}`;
        }
      );
      return `import ${varName} from '../data/${file}';`;
    });

    // Exercise exports - create a single object with language keys
    const exerciseExports = [`export const EXERCISES_JSON = {`];

    exerciseFiles.forEach((file) => {
      const baseName = path.basename(file, '.json');
      // Convert exercisesEnUS -> EN_US to match language constants
      const langKey = baseName
        .replace('exercises', '')
        .replace(/([A-Z][a-z]+)([A-Z][A-Za-z]*)/, (match, lang, region) => {
          return `${lang.toUpperCase()}_${region.toUpperCase()}`;
        });
      // Convert exercisesEnUS -> exercisesEnUs for the variable name
      const varName = baseName.replace(
        /exercises([A-Z][a-z]+)([A-Z][A-Za-z]*)/,
        (match, lang, region) => {
          return `exercises${lang}${region.charAt(0).toUpperCase() + region.slice(1).toLowerCase()}`;
        }
      );
      exerciseExports.push(`  [${langKey}]: ${varName},`);
    });

    exerciseExports.push('};');

    // Language constants
    const constantLines = languages.map(
      (lang) => `export const ${constantName(lang)} = '${dirToLanguageTag(lang.dir)}';`
    );

    // Resources object entries per language
    const resourceEntries = languages.map((lang) => {
      const prefix = varPrefix(lang);
      const spreads = lang.files.map((file) => {
        const baseName = path.basename(file, '.json');
        const suffix = fileNameToSuffix(baseName);
        return `      ...${prefix}${suffix},`;
      });
      const allSpreads = [`      ...untranslated,`, ...spreads];
      return `  [${constantName(lang)}]: {\n    translation: {\n${allSpreads.join('\n')}\n    },\n  },`;
    });

    // LOCALE_MAP entries
    const localeMapEntries = languages
      .filter((l) => l.dateFnsLocaleName)
      .map((lang) => {
        const dfVar = dateFnsLocaleKeyToVarName(lang.dateFnsLocaleName);
        const localeAlias = `locale${dfVar.charAt(0).toUpperCase() + dfVar.slice(1)}`;
        return `  [${constantName(lang)}]: ${localeAlias},`;
      });

    const output = [
      '// ATTENTION: This file and locales/untranslated.json are generated by scripts/generateLangFile.js',
      '// Do not edit this file manually. Changes will be overwritten.',
      '',
      "import 'intl-pluralrules';",
      '',
      'import {',
      dateFnsImportNames.map((n) => `  ${n},`).join('\n'),
      "} from 'date-fns/locale';",
      "import * as Localization from 'expo-localization';",
      "import i18n from 'i18next';",
      "import { initReactI18next } from 'react-i18next';",
      '',
      '// untranslated',
      "import untranslated from './locales/untranslated.json';",
      '',
      jsonImportBlocks.join('\n\n'),
      '',
      '// Exercise data',
      ...exerciseImports,
      '',
      constantLines.join('\n'),
      '',
      '// Exercise exports',
      ...exerciseExports,
      '',
      'const resources = {',
      resourceEntries.join('\n'),
      '};',
      '',
      'export type LanguageKeys = keyof typeof resources;',
      '',
      'export const LOCALE_MAP = {',
      localeMapEntries.join('\n'),
      '};',
      '',
      'export const AVAILABLE_LANGUAGES = Object.keys(resources) as LanguageKeys[];',
      '',
      'const systemLocales = Localization.getLocales();',
      '',
      'i18n.use(initReactI18next).init({',
      "  // compatibilityJSON: 'v3',",
      '  debug: __DEV__,',
      `  fallbackLng: ${constantName(languages[0])},`,
      '  interpolation: {',
      '    escapeValue: false,',
      '  },',
      '  lng:',
      `    systemLocales.find((locale) => AVAILABLE_LANGUAGES.includes(locale.languageTag as LanguageKeys))`,
      `      ?.languageTag || ${constantName(languages[0])},`,
      '  resources,',
      '});',
      '',
      'export const languageLabels: Record<string, string> = {',
      languages
        .map((lang) => `  [${constantName(lang)}]: i18n.t('untranslated.${lang.dir}.name'),`)
        .join('\n'),
      '};',
      '',
      "export const LANDING_LANGUAGE_STORAGE_KEY = 'musclog_lang';",
      '',
      '// Language multipliers for UI layout calculations based on IBM Globalization Design Guide expansion factors.',
      'export const LANGUAGE_MULTIPLIERS: Record<string, number> = {',
      languages
        .map((lang) => {
          const baseLang = lang.dir.split('-')[0];
          const multiplier = IBM_EXPANSION_TABLE[baseLang];
          if (multiplier === undefined || multiplier === 1.0) {
            return null;
          }

          return `  '${dirToLanguageTag(lang.dir)}': ${multiplier},`;
        })
        .filter(Boolean)
        .join('\n'),
      '};',
      '',
      '// Mirror the active language to localStorage so the static landing panel',
      '// (+html.tsx) can pick it up before React boots.',
      "if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {",
      "  i18n.on('languageChanged', (lng) => {",
      '    try {',
      '      window.localStorage.setItem(LANDING_LANGUAGE_STORAGE_KEY, lng);',
      '    } catch (_) {',
      '      // private/storage-full — ignore',
      '    }',
      '  });',
      '}',
      '',
      'export default i18n;',
      '',
    ].join('\n');

    const eslint = new ESLint({
      baseConfig: eslintBaseConfig,
      fix: true,
    });

    eslint
      .lintText(output, { filePath: outputFilePath })
      .then((results) => {
        const fixed = results[0].output || output;

        return prettier
          .resolveConfig(outputFilePath)
          .then((config) => prettier.format(fixed, { ...config, filepath: outputFilePath }))
          .then((formatted) => {
            fs.writeFile(outputFilePath, formatted, (writeErr) => {
              if (writeErr) {
                console.error('Error writing lang.ts:', writeErr);
              } else {
                console.log(`Generated ${outputFilePath}`);
              }
            });
          });
      })
      .catch((lintErr) => {
        console.error('Error running ESLint:', lintErr);
      });
  });
});
