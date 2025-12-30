const fs = require('fs');
const glob = require('glob');

// Paths to translation files
const translationFiles = {
    'en-US': './lang/locales/en-us.json',
    'es-ES': './lang/locales/es-es.json',
    'nl-NL': './lang/locales/nl-nl.json',
    'pt-BR': './lang/locales/pt-br.json',
};

// Function to get all keys from translation files
const getTranslationKeys = (filePath) => {
    const translations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const keys = [];

    const extractKeys = (obj, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object') {
                extractKeys(value, newKey);
            } else {
                keys.push(newKey);
            }
        }
    };

    extractKeys(translations);
    return keys;
};

// Read all translation keys
const translationKeys = {};
for (const [locale, filePath] of Object.entries(translationFiles)) {
    translationKeys[locale] = getTranslationKeys(filePath);
}

// Get all JavaScript and TypeScript files in the src directory
const files = glob.sync('./**/*.{js,ts,jsx,tsx}', {
    ignore: './node_modules/**',
});

const extractUsedKeys = (content) => {
    const regex = /[\s{(]t\(['"`]([^'"`]+)['"`]\)/g;
    const keys = new Set();
    let match;

    while ((match = regex.exec(content)) !== null) {
        keys.add(match[1]);
    }

    return keys;
};

// Check for missing keys
const missingKeys = {
    'en-US': new Set(),
    'es-ES': new Set(),
    'nl-NL': new Set(),
    'pt-BR': new Set(),
};

// Scan all files
for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const usedKeys = extractUsedKeys(content);

    for (const key of usedKeys) {
        for (const locale of Object.keys(translationFiles)) {
            if (!translationKeys[locale].includes(key)) {
                missingKeys[locale].add(key);
            }
        }
    }
}

// Report missing keys
for (const [locale, keys] of Object.entries(missingKeys)) {
    if (keys.size > 0) {
        console.log(`Missing keys in ${locale}:`);
        keys.forEach((key) => console.log(`  - ${key}`));
    } else {
        console.log(`No missing keys in ${locale}`);
    }
}
