#!/usr/bin/env node
/* eslint-disable no-undef */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const CONFIG = {
  localeDir: path.join(__dirname, '../lang/locales/en-us'),
  scanPaths: [
    '../app/**/*.tsx',
    '../components/**/*.tsx',
    '../utils/**/*.ts',
    '../hooks/**/*.ts',
    '../types/**/*.ts',
    '../services/**/*.ts',
  ],
  patterns: [
    /t\(['"`]([^'"`]+)['"`]\)/g, // t('key')
    /t\(`([^`]+)`\)/g, // t(`key`)
    /t\(['"`]([^'"`]+)['"`]\s*,/g, // t('key', options)
    /t\(`([^`]+)`\s*,/g, // t(`key`, options)
  ],
  ignorePatterns: [
    '**/node_modules/**',
    '**/*.test.tsx',
    '**/*.test.ts',
    '**/*.spec.tsx',
    '**/*.spec.ts',
    '**/__tests__/**',
  ],
};

class TranslationScanner {
  constructor(options = {}) {
    this.existingKeys = new Set();
    this.usedKeys = new Set();
    this.missingKeys = new Set();
    this.filesWithTranslations = new Map();
    this.missingKeyLocations = new Map();
    this.keyToFile = new Map(); // key -> path to JSON file (for cleanup)
    this.namespaceToFile = new Map(); // namespace -> path (for add-missing)
    this.cleanup = options.cleanup || false;
    this.addMissing = options.addMissing || false;
  }

  // Load existing translations from all JSON files in locale directory
  loadExistingTranslations() {
    try {
      const files = glob.sync('*.json', { cwd: CONFIG.localeDir, absolute: true });
      if (files.length === 0) {
        console.error('✗ No JSON files found in', CONFIG.localeDir);
        process.exit(1);
      }
      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        for (const topLevelKey of Object.keys(data)) {
          this.namespaceToFile.set(topLevelKey, filePath);
          this.extractKeysFromObject(data[topLevelKey], topLevelKey, filePath);
        }
      }
      console.log(
        `✓ Loaded ${this.existingKeys.size} existing translation keys from ${files.length} files`
      );
    } catch (error) {
      console.error('✗ Error loading translation files:', error.message);
      process.exit(1);
    }
  }

  // Recursively extract all keys from nested translation object
  extractKeysFromObject(obj, prefix = '', filePath = null) {
    if (typeof obj !== 'object' || obj === null) {
      if (prefix) {
        this.existingKeys.add(prefix);
        if (filePath) {
          this.keyToFile.set(prefix, filePath);
        }
      }
      return;
    }
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null) {
        this.extractKeysFromObject(value, fullKey, filePath);
      } else {
        this.existingKeys.add(fullKey);
        if (filePath) {
          this.keyToFile.set(fullKey, filePath);
        }
      }
    }
  }

  // Find all TSX files to scan
  findFilesToScan() {
    const files = [];

    for (const pattern of CONFIG.scanPaths) {
      try {
        const matchedFiles = glob.sync(pattern, {
          cwd: __dirname,
          ignore: CONFIG.ignorePatterns,
          absolute: true,
        });
        files.push(...matchedFiles);
      } catch (error) {
        console.error(`Error processing pattern ${pattern}:`, error.message);
      }
    }

    return [...new Set(files)]; // Remove duplicates
  }

  // Extract translation keys from a single file
  extractKeysFromFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const fileKeys = new Set();
      const lines = content.split('\n');

      for (const pattern of CONFIG.patterns) {
        let match;
        // Reset regex lastIndex for each pattern
        pattern.lastIndex = 0;

        while ((match = pattern.exec(content)) !== null) {
          const key = match[1];

          // Find line number for this match
          const matchIndex = match.index;
          const lineNumber = lines.slice(
            0,
            content.substring(0, matchIndex).split('\n').length
          ).length;

          if (key) {
            // Filter out invalid keys
            if (!this.isValidTranslationKey(key)) {
              continue;
            }

            // If the key contains a template literal with a variable, extract the static part
            const dynamicMatch = key.match(/^(.*?)\$\{[^}]+}/);
            if (dynamicMatch) {
              const staticKey = dynamicMatch[1].replace(/\.$/, '');
              fileKeys.add(staticKey);

              // Track location for missing keys
              if (!this.existingKeys.has(staticKey)) {
                if (!this.missingKeyLocations.has(staticKey)) {
                  this.missingKeyLocations.set(staticKey, []);
                }
                this.missingKeyLocations.get(staticKey).push({ file: filePath, line: lineNumber });
              }
            } else {
              fileKeys.add(key);

              // Track location for missing keys
              if (!this.existingKeys.has(key)) {
                if (!this.missingKeyLocations.has(key)) {
                  this.missingKeyLocations.set(key, []);
                }
                this.missingKeyLocations.get(key).push({ file: filePath, line: lineNumber });
              }
            }
          }
        }
      }

      return fileKeys;
    } catch (error) {
      console.error(`✗ Error reading file ${filePath}:`, error.message);
      return new Set();
    }
  }

  // Scan all files for translation usage
  scanFiles() {
    const files = this.findFilesToScan();
    console.log(`📁 Scanning ${files.length} TSX files...`);

    for (const filePath of files) {
      const keys = this.extractKeysFromFile(filePath);

      if (keys.size > 0) {
        this.filesWithTranslations.set(filePath, keys);
        for (const key of keys) {
          this.usedKeys.add(key);
        }
      }
    }

    console.log(`✓ Found ${this.usedKeys.size} translation keys in code`);
  }

  // Find missing translations
  findMissingTranslations() {
    // Helper: key exists if it's in existingKeys or is a prefix of an existing key (parent key)
    const keyExists = (key) =>
      this.existingKeys.has(key) || [...this.existingKeys].some((ek) => ek.startsWith(key + '.'));

    // First, add all exact matches
    for (const key of this.usedKeys) {
      if (!keyExists(key)) {
        this.missingKeys.add(key);
      }
    }

    // Then, handle dynamic prefixes - mark all nested keys as used
    for (const usedKey of this.usedKeys) {
      for (const existingKey of this.existingKeys) {
        if (existingKey.startsWith(usedKey + '.')) {
          this.usedKeys.add(existingKey);
        }
      }
    }

    // Recalculate missing keys (only report if key doesn't exist and isn't a parent of existing keys)
    this.missingKeys.clear();
    for (const key of this.usedKeys) {
      if (!keyExists(key)) {
        this.missingKeys.add(key);
      }
    }
  }

  // Check if a key is a valid translation key
  isValidTranslationKey(key) {
    // Exclude empty strings, single characters, obvious non-keys
    if (!key || key.length < 2) {
      return false;
    }

    // Exclude keys that look like file paths, URLs, or code
    if (key.includes('/') || key.includes('node_modules') || key.includes('.d.ts')) {
      return false;
    }

    // Exclude keys that are just symbols or numbers
    if (/^[^a-zA-Z]+$/.test(key) && key.length < 3) {
      return false;
    }

    // Exclude obvious code patterns
    if (key.includes('function') || key.includes('const') || key.includes('return')) {
      return false;
    }

    // Exclude boundary strings and form data
    if (['------', 'content-disposition'].some((s) => key.includes(s))) {
      return false;
    }

    return true;
  }

  // Remove unused translations from the locale files (per-file)
  cleanupUnusedTranslations() {
    const unusedKeys = [...this.existingKeys].filter((key) => !this.usedKeys.has(key));

    if (unusedKeys.length === 0) {
      console.log('\n✅ No unused translations to remove.');
      return;
    }

    const keysByFile = new Map();
    for (const key of unusedKeys) {
      const filePath = this.keyToFile.get(key);
      if (filePath) {
        if (!keysByFile.has(filePath)) {
          keysByFile.set(filePath, []);
        }
        keysByFile.get(filePath).push(key);
      }
    }

    try {
      for (const [filePath, keys] of keysByFile) {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        for (const topLevelKey of Object.keys(data)) {
          this.removeUnusedKeysFromObject(data[topLevelKey], keys, topLevelKey);
        }
        const cleanedContent = JSON.stringify(data, null, 2) + '\n';
        fs.writeFileSync(filePath, cleanedContent, 'utf8');
      }
      console.log(
        `\n🧹 Removed ${unusedKeys.length} unused translations from ${keysByFile.size} file(s)`
      );
      console.log('📝 Original files have been overwritten.');
    } catch (error) {
      console.error('✗ Error cleaning up translations:', error.message);
    }
  }

  // Recursively remove unused keys from an object (prefix used for fullKey)
  removeUnusedKeysFromObject(obj, unusedKeys, prefix = '') {
    const keysToRemove = [];

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null) {
        this.removeUnusedKeysFromObject(value, unusedKeys, fullKey);
        if (Object.keys(value).length === 0) {
          keysToRemove.push(key);
        }
      } else if (unusedKeys.includes(fullKey)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      delete obj[key];
    }
  }
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 TRANSLATION SCAN REPORT');
    console.log('='.repeat(60));

    console.log(`\n📊 SUMMARY:`);
    console.log(`   • Existing translations: ${this.existingKeys.size}`);
    console.log(`   • Used translations in code: ${this.usedKeys.size}`);
    console.log(`   • Missing translations: ${this.missingKeys.size}`);

    if (this.missingKeys.size > 0) {
      console.log(`\n❌ MISSING TRANSLATIONS (${this.missingKeys.size}):`);
      console.log('─'.repeat(40));

      // Group missing keys by file for better context
      const missingByFile = new Map();

      for (const key of this.missingKeys) {
        const locations = this.missingKeyLocations.get(key) || [];
        for (const location of locations) {
          const relativePath = path.relative(process.cwd(), location.file);
          if (!missingByFile.has(relativePath)) {
            missingByFile.set(relativePath, []);
          }
          missingByFile.get(relativePath).push({ key, line: location.line });
        }
      }

      for (const [filePath, missingInfos] of missingByFile) {
        const relativePath = path.relative(process.cwd(), filePath);
        console.log(`\n📄 ${relativePath}:`);
        for (const { key, line } of missingInfos) {
          console.log(`   • ${key} (line ${line})`);
        }
      }

      console.log('\n💡 SUGGESTED ADDITIONS (per-namespace in lang/locales/en-us/*.json):');
      console.log('{');

      const sortedMissing = Array.from(this.missingKeys)
        .sort()
        .filter((key) => {
          return (key.includes('.') || key.includes('_')) && !key.includes(' ');
        });

      for (const key of sortedMissing) {
        console.log(`  "${key}": "TODO add this translation",`);
      }
      console.log('}');

      // Only add missing keys to locale files if the user explicitly passed --add-missing
      if (this.addMissing) {
        try {
          const missingByNamespace = new Map();
          for (const key of sortedMissing) {
            const ns = key.split('.')[0];
            if (!missingByNamespace.has(ns)) {
              missingByNamespace.set(ns, []);
            }
            missingByNamespace.get(ns).push(key);
          }
          let addedCount = 0;
          for (const [namespace, keys] of missingByNamespace) {
            const filePath = this.namespaceToFile.get(namespace);
            if (!filePath) {
              console.log(
                `\n⚠️  No locale file for namespace "${namespace}". Add keys manually or create ${path.join(CONFIG.localeDir, namespace + '.json')}.`
              );
              continue;
            }
            const backupPath = `${filePath}.bak.${Date.now()}`;
            fs.copyFileSync(filePath, backupPath);
            console.log(`\n🔁 Backup: ${path.relative(process.cwd(), backupPath)}`);

            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            const rootKey = Object.keys(data)[0];
            if (!rootKey) {
              continue;
            }
            let node = data[rootKey];

            for (const key of keys) {
              const parts = key.split('.');
              if (parts[0] !== rootKey) {
                continue;
              }
              const keyParts = parts.slice(1);
              let n = node;
              for (let i = 0; i < keyParts.length; i++) {
                const part = keyParts[i];
                if (i === keyParts.length - 1) {
                  if (n[part] === undefined) {
                    n[part] = this.generateDefaultValue(key);
                    addedCount++;
                  }
                } else {
                  if (n[part] === undefined || typeof n[part] !== 'object') {
                    n[part] = {};
                  }
                  n = n[part];
                }
              }
            }

            const newContent = JSON.stringify(data, null, 2) + '\n';
            fs.writeFileSync(filePath, newContent, 'utf8');
          }
          if (addedCount > 0) {
            console.log(
              `\n✅ Added ${addedCount} missing key(s) to locale files in ${CONFIG.localeDir}`
            );
          }
        } catch (err) {
          console.error('✗ Failed to add missing keys to locale files:', err.message || err);
        }
      } else {
        console.log(
          '\nℹ️  Missing keys not added. Re-run with --add-missing or -a to auto-insert them into the locale files.'
        );
      }
    } else {
      console.log('\n✅ All translations found! No missing keys detected.');
    }

    // Find unused translations
    const unusedKeys = [...this.existingKeys].filter((key) => !this.usedKeys.has(key));
    if (unusedKeys.length > 0) {
      console.log(`\n⚠️  UNUSED TRANSLATIONS (${unusedKeys.length}):`);
      console.log('─'.repeat(40));
      for (const key of unusedKeys.sort()) {
        console.log(`   • ${key}`);
      }
      console.log('\n💡 Consider removing these unused keys to keep your translation file clean.');
    }

    console.log('\n' + '='.repeat(60));

    // Perform cleanup if requested (before exit code check)
    if (this.cleanup) {
      this.cleanupUnusedTranslations();
    }

    // Exit with error code if missing translations found (but only if not cleaning up)
    if (this.missingKeys.size > 0 && !this.cleanup) {
      process.exit(1);
    }
  }

  // Generate a default value for missing translation keys
  generateDefaultValue(key) {
    return key
      .split('.')
      .pop() // Get the last part of the key
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
      .trim()
      .replaceAll('_', ' ');
  }

  // Run the complete scan
  run() {
    console.log('🚀 Starting translation scan...\n');

    this.loadExistingTranslations();
    this.scanFiles();
    this.findMissingTranslations();
    this.generateReport();

    // Perform cleanup if requested
    if (this.cleanup) {
      this.cleanupUnusedTranslations();
    }
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  if (args.includes('--cleanup') || args.includes('-c')) {
    options.cleanup = true;
  }

  if (args.includes('--add-missing') || args.includes('-a')) {
    options.addMissing = true;
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔍 Translation Scanner

Usage: node scripts/check-translations.js [options]

Reads all JSON files from lang/locales/en-us/ (one namespace per file).

Options:
  --cleanup, -c    Remove unused translations from locale files
  --add-missing, -a  Add missing translation keys to the correct locale file (creates backups)
  --help, -h       Show this help message

Examples:
  node scripts/check-translations.js              # Scan and report only
  node scripts/check-translations.js --cleanup     # Scan and remove unused translations
  npm run check-translations -- --cleanup         # Via npm
`);
    process.exit(0);
  }

  return options;
}

// Check if glob package is available, try to install if not
try {
  require.resolve('glob');
} catch (_err) {
  console.error('❌ "glob" package is required. Please install it with:');
  console.error('   npm install glob');
  console.error('   or yarn add glob');
  process.exit(1);
}

// Run the scanner
if (require.main === module) {
  const options = parseArgs();
  const scanner = new TranslationScanner(options);
  scanner.run();
}

module.exports = TranslationScanner;
