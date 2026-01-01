const { ESLint } = require('eslint');
const fs = require('fs');
const path = require('path');

const eslintBaseConfig = require('../eslint.config.js');

const DIRNAME = __dirname;
const localesDir = path.join(DIRNAME, '..', 'lang', 'locales');
const outputFilePath = path.join(DIRNAME, '..', 'lang', 'lang.ts');
const dateFnsLocalePath = path.join(DIRNAME, '..', 'node_modules', 'date-fns', 'locale.d.ts');

const EN_US = 'en-US';
const AVAILABLE_LANGUAGES = [];
const resources = [];
const initReactI18next = {};
const Localization = {};

const i18n = {
    init: () => i18n,
    use: () => i18n,
};

const i18Configuration = () => {
    const systemLocales = Localization.getLocales();

    i18n
        .use(initReactI18next)
        .init({
            // compatibilityJSON: 'v3',
            // debug: true,
            fallbackLng: EN_US,
            interpolation: {
                escapeValue: false,
            },
            lng: systemLocales.find(
                (locale) => AVAILABLE_LANGUAGES.includes(locale.languageTag)
            )?.languageTag || EN_US,
            resources,
        });
};

// Function to read and parse the date-fns locale definitions
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
            const locale = match[1];
            localeExports[locale] = locale;
        }

        callback(localeExports);
    });
}

// Read all files from the locales directory
fs.readdir(localesDir, (err, files) => {
    if (err) {
        console.error('Error reading locales directory:', err);
        return;
    }

    // Filter JSON files excluding en-us.json
    const jsonFiles = files.filter((file) => file.endsWith('.json') && file !== 'en-us.json');

    // Generate import statements, resources entries, locale map entries, and constants
    const imports = [];
    const resourcesEntries = [];
    const localeMapEntries = [];
    const constants = ["export const EN_US = 'en-US';"];
    const exercisesImports = [];
    const localeVariables = [];

    // Parse date-fns locale definitions and generate the required entries
    getDateFnsLocales((localeExports) => {
        jsonFiles.forEach((file) => {
            const baseName = path.basename(file, '.json');
            const constantName = baseName.toUpperCase().replace(/-/g, '_');

            const langName = baseName.split('-').map(
                (word, index) => (index === 1 ? word.toUpperCase() : word)
            )
                .join('-');

            constants.push(`export const ${constantName} = '${langName}';`);

            let dateFnsLocale = null;
            if (localeExports[baseName]) {
                dateFnsLocale = baseName;
            } else {
                const parts = baseName.split('-');
                if (parts.length > 1 && localeExports[`${parts[0]}-${parts[1].toUpperCase()}`]) {
                    dateFnsLocale = `${parts[0]}-${parts[1].toUpperCase()}`;
                } else if (localeExports[parts[0]]) {
                    dateFnsLocale = parts[0];
                }
            }

            if (dateFnsLocale) {
                const localeVariable = dateFnsLocale.includes('-')
                    ? dateFnsLocale.replace(/-/g, '')
                    : dateFnsLocale;

                localeVariables.push(localeVariable);
                imports.push(`import ${localeVariable} from './locales/${file}';`);
                const exerciseDataLocale = localeVariable.split('').reduce((acc, char, index) => acc + (index === 0 ? char.toUpperCase() : char), '');
                exercisesImports.push(`import exercises${exerciseDataLocale}Data from '@/data/exercises${exerciseDataLocale}.json';`);
                resourcesEntries.push(`[${constantName}]: { translation: ${localeVariable} },`);
                localeMapEntries.push(`[${constantName}]: locale${localeVariable.charAt(0).toUpperCase() + localeVariable.slice(1)},`);
            }
        });

        const output = [
            "import exercisesEnUSData from '@/data/exercisesEnUS.json';",
            `${exercisesImports.join('\n')}`,
            'import {',
            'enUS as localeEnUS,',
            imports.map(
                (imp) => imp.split(' ')[1] + ' as locale' + imp.split(' ')[1].charAt(0).toUpperCase() + imp.split(' ')[1].slice(1)
            ).join(',\n    '),
            "} from 'date-fns/locale';",
            "import * as Localization from 'expo-localization';",
            "import i18n from 'i18next';",
            "import 'intl-pluralrules';",
            "import { initReactI18next } from 'react-i18next';",
            '',
            "import enUs from './locales/en-us.json';",
            `${imports.join('\n')}`,
            '',
            `${constants.join('\n')}`,
            '',
            'const resources = {',
            '[EN_US]: { translation: enUs },',
            `${resourcesEntries.join('\n')}`,
            '};',
            '',
            'export const EXERCISES_DATA = {',
            '[EN_US]: exercisesEnUSData,',
            `${jsonFiles.map((file, index) => {
                const constantName = path.basename(file, '.json').toUpperCase()
                    .replace(/-/g, '_');
                const localeVariable = localeVariables[index];

                const exerciseDataLocale = localeVariable.split('').reduce((acc, char, index) => acc + (index === 0 ? char.toUpperCase() : char), '');
                return `[${constantName}]: exercises${exerciseDataLocale}Data,`;
            }).join('\n')}`,
            '} as const;',
            '',
            'export const getExerciseData = (lang: LanguageKeys) => EXERCISES_DATA[lang] || EXERCISES_DATA[EN_US];',
            '',
            'export type LanguageKeys = keyof typeof resources;',
            '',
            'export const LOCALE_MAP = {',
            '[EN_US]: localeEnUS,',
            localeMapEntries.join('\n'),
            '};',
            '',
            'export const AVAILABLE_LANGUAGES = Object.keys(resources) as LanguageKeys[];',
            '',
            i18Configuration.toString().slice(7, -1)
                .trim()
                .replace('AVAILABLE_LANGUAGES.includes(locale.languageTag)', 'AVAILABLE_LANGUAGES.includes(locale.languageTag as LanguageKeys)'),
            '',
            'export default i18n;',
            '',
        ].join('\n');

        // Run ESLint on the generated output
        const eslint = new ESLint({
            baseConfig: eslintBaseConfig,
            fix: true,
        });

        eslint.lintText(output).then((lintResults) => {
            // eslint-disable-next-line promise/always-return
            const lintedOutput = lintResults[0].output || output;

            // Write the output to the lang.ts file
            fs.writeFile(outputFilePath, lintedOutput, (err) => {
                if (err) {
                    console.error('Error writing lang.ts file:', err);
                } else {
                    console.log(`Generated ${outputFilePath}`);
                }
            });
        })
            .catch((err) => {
                console.error('Error running ESLint:', err);
            });
    });
});
