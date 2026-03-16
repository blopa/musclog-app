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
const outputFilePath = path.join(DIRNAME, '..', 'lang', 'lang.ts');
const dateFnsLocalePath = path.join(DIRNAME, '..', 'node_modules', 'date-fns', 'locale.d.ts');

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

// en-us → enUS (date-fns locale variable name, e.g. enUS, ptBR)
function dirToDateFnsVar(dir) {
  const [lang, region] = dir.split('-');
  return lang + region.toUpperCase();
}

// access_token → AccessToken, addMeal → AddMeal, food_food_portions → FoodFoodPortions
function fileNameToSuffix(baseName) {
  return baseName
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
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
    const dateFnsVar = (lang) => dirToDateFnsVar(lang.dir);

    // date-fns imports (one per language that has a matching locale)
    const dateFnsImportNames = languages
      .filter((l) => l.dateFnsLocaleName)
      .map((l) => {
        const dfVar = dateFnsVar(l);
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
        const dfVar = dateFnsVar(lang);
        const localeAlias = `locale${dfVar.charAt(0).toUpperCase() + dfVar.slice(1)}`;
        return `  [${constantName(lang)}]: ${localeAlias},`;
      });

    const output = [
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
      constantLines.join('\n'),
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
      'export const languageLabels: Record<string, string> = {',
      languages
        .map((lang) => `  [${constantName(lang)}]: i18n.t('untranslated.${lang.dir}'),`)
        .join('\n'),
      '};',
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
