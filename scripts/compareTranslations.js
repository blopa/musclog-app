const fs = require('fs');

// Paths to translation files
const translationFiles = {
    'en-US': './lang/locales/en-us.json',
    'es-ES': './lang/locales/es-es.json',
    'nl-NL': './lang/locales/nl-nl.json',
    'pt-BR': './lang/locales/pt-br.json',
};

// Function to recursively collect keys from nested objects
function collectKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            keys = keys.concat(collectKeys(obj[key], fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

// Read and store all translation keys
const translationKeys = {};
for (const [locale, filePath] of Object.entries(translationFiles)) {
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        translationKeys[locale] = collectKeys(data);
    } catch (error) {
        console.error(`Error reading ${locale} file:`, error.message);
    }
}

// Compare translation keys
const referenceKeys = translationKeys['en-US']; // Use en-US as the reference
let isConsistent = true;

for (const [locale, keys] of Object.entries(translationKeys)) {
    if (locale !== 'en-US') {
        const missingKeys = referenceKeys.filter((key) => !keys.includes(key));
        const extraKeys = keys.filter((key) => !referenceKeys.includes(key));

        if (missingKeys.length > 0 || extraKeys.length > 0) {
            isConsistent = false;
            console.log(`Discrepancies in ${locale}:`);
            if (missingKeys.length > 0) {
                console.log(`- Missing keys: ${missingKeys.join(', ')}`);
            }
            if (extraKeys.length > 0) {
                console.log(`- Extra keys: ${extraKeys.join(', ')}`);
            }
        }
    }

    // Check if order is consistent
    if (JSON.stringify(keys) !== JSON.stringify(referenceKeys)) {
        isConsistent = false;
        console.log(`Order of keys is different in ${locale}`);
    }
}

if (isConsistent) {
    console.log('All translation files have consistent keys and ordering.');
} else {
    console.log('Some translation files have discrepancies. See details above.');
}
