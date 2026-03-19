#!/usr/bin/env node
/* eslint-disable no-undef */

const fs = require('fs');
const path = require('path');

/**
 * Script to check translation key consistency across locale directories.
 *
 * It lists all directories in lang/locales/, then for each JSON file,
 * checks if all translation keys (including nested ones) exist in the
 * corresponding JSON files of other locale directories.
 */

const LOCALES_DIR = path.join(__dirname, '../lang/locales');

/**
 * Recursively extract all dot-notation keys from a nested object
 * @param {object} obj - The object to extract keys from
 * @param {string} prefix - Key prefix for recursion
 * @returns {string[]} - Array of dot-notation keys
 */
function extractKeys(obj, prefix = '') {
  const keys = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...extractKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

/**
 * Get all locale directories in the locales folder
 * @returns {string[]} - Array of directory names
 */
function getLocaleDirectories() {
  const entries = fs.readdirSync(LOCALES_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Get all JSON files in a locale directory
 * @param {string} localeDir - Locale directory name
 * @returns {string[]} - Array of JSON file names
 */
function getJsonFiles(localeDir) {
  const dirPath = path.join(LOCALES_DIR, localeDir);
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Load and parse a JSON file
 * @param {string} localeDir - Locale directory name
 * @param {string} filename - JSON file name
 * @returns {object|null} - Parsed JSON or null on error
 */
function loadJsonFile(localeDir, filename) {
  const filePath = path.join(LOCALES_DIR, localeDir, filename);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Error reading ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Find missing keys in target compared to source
 * @param {string[]} sourceKeys - Keys from source locale
 * @param {string[]} targetKeys - Keys from target locale
 * @returns {string[]} - Keys missing in target
 */
function findMissingKeys(sourceKeys, targetKeys) {
  const targetSet = new Set(targetKeys);
  return sourceKeys.filter((key) => !targetSet.has(key));
}

/**
 * Main function to run the consistency check
 */
function run() {
  console.log('🔍 Checking translation consistency across locales...\n');

  const locales = getLocaleDirectories();

  if (locales.length < 2) {
    console.log('⚠️  Need at least 2 locale directories to compare.');
    console.log(`   Found: ${locales.join(', ') || 'none'}`);
    process.exit(0);
  }

  console.log(`📁 Found ${locales.length} locales: ${locales.join(', ')}\n`);

  // Get all unique JSON filenames across all locales
  const allJsonFiles = new Set();
  for (const locale of locales) {
    const files = getJsonFiles(locale);
    files.forEach((file) => allJsonFiles.add(file));
  }
  const sortedJsonFiles = [...allJsonFiles].sort();

  console.log(`📄 Found ${sortedJsonFiles.length} unique JSON files:\n`);

  let hasErrors = false;
  const missingKeysReport = [];
  const extraKeysReport = [];

  for (const jsonFile of sortedJsonFiles) {
    console.log(`▶️  Checking: ${jsonFile}`);

    // Load all locale versions of this file
    const localeData = {};
    const localeKeys = {};

    for (const locale of locales) {
      const data = loadJsonFile(locale, jsonFile);
      if (data) {
        localeData[locale] = data;
        localeKeys[locale] = extractKeys(data);
      }
    }

    const availableLocales = Object.keys(localeData);

    if (availableLocales.length < 2) {
      console.log(`   ⚠️  Only found in: ${availableLocales.join(', ') || 'none'}`);
      console.log('');
      continue;
    }

    // Build union of all keys across locales for this file
    const allKeys = new Set();
    for (const keys of Object.values(localeKeys)) {
      keys.forEach((key) => allKeys.add(key));
    }
    const sortedAllKeys = [...allKeys].sort();

    // Check each locale for missing/extra keys
    const fileMissingKeys = [];
    const fileExtraKeys = [];

    for (const locale of availableLocales) {
      const keys = localeKeys[locale];
      const missing = findMissingKeys(sortedAllKeys, keys);
      const extra = findMissingKeys(keys, sortedAllKeys);

      if (missing.length > 0) {
        fileMissingKeys.push({ locale, missing });
      }
      if (extra.length > 0) {
        fileExtraKeys.push({ locale, extra });
      }
    }

    // Report results for this file
    if (fileMissingKeys.length === 0 && fileExtraKeys.length === 0) {
      console.log(`   ✅ All locales have matching keys (${sortedAllKeys.length} keys)`);
    } else {
      hasErrors = true;

      if (fileMissingKeys.length > 0) {
        console.log(`   ❌ Missing keys found:`);
        for (const { locale, missing } of fileMissingKeys) {
          console.log(`      ${locale}: ${missing.length} missing`);
          for (const key of missing) {
            console.log(`         - ${key}`);
          }
          missingKeysReport.push({ file: jsonFile, locale, keys: missing });
        }
      }

      if (fileExtraKeys.length > 0) {
        console.log(`   ⚠️  Extra keys found (not in other locales):`);
        for (const { locale, extra } of fileExtraKeys) {
          console.log(`      ${locale}: ${extra.length} extra`);
          for (const key of extra) {
            console.log(`         + ${key}`);
          }
          extraKeysReport.push({ file: jsonFile, locale, keys: extra });
        }
      }
    }

    console.log('');
  }

  // Final summary
  console.log('='.repeat(60));
  console.log('📊 MISSING KEYS');
  console.log('='.repeat(60));

  if (!hasErrors) {
    console.log('✅ All translation files are consistent across all locales!');
  } else {
    for (const { file, locale, keys } of missingKeysReport) {
      for (const key of keys) {
        console.log(`${key} (missing in: ${locale} @ ${file})`);
      }
    }

    process.exit(1);
  }
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🔍 Locale Consistency Checker

Checks that all translation keys (including nested ones) exist consistently
across all locale directories in lang/locales/.

Usage: node scripts/check-locale-consistency.js [options]

Options:
  --help, -h    Show this help message

Examples:
  node scripts/check-locale-consistency.js
  npm run check-locale-consistency
`);
  process.exit(0);
}

// Run the check
run();
