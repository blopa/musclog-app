#!/usr/bin/env node
/* eslint-disable no-undef */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const CONFIG = {
  localeFile: path.join(__dirname, '../lang/locales/en-us.json'),
  scanPaths: ['../app/**/*.tsx', '../components/**/*.tsx'],
  patterns: [
    /t\(['"`]([^'"`]+)['"`]\)/g, // t('key')
    /t\(`([^`]+)`\)/g, // t(`key`)
    /t\(['"`]([^'"`]+)['"`]\s*,/g, // t('key', options)
    /t\(`([^`]+)`\s*,/g, // t(`key`, options)
  ],
  ignorePatterns: ['**/node_modules/**', '**/*.test.tsx', '**/*.spec.tsx'],
};

class TranslationScanner {
  constructor() {
    this.existingKeys = new Set();
    this.usedKeys = new Set();
    this.missingKeys = new Set();
    this.filesWithTranslations = new Map();
  }

  // Load existing translations from JSON file
  loadExistingTranslations() {
    try {
      const content = fs.readFileSync(CONFIG.localeFile, 'utf8');
      const translations = JSON.parse(content);
      this.extractKeysFromObject(translations, '');
      console.log(`✓ Loaded ${this.existingKeys.size} existing translation keys`);
    } catch (error) {
      console.error('✗ Error loading translation file:', error.message);
      process.exit(1);
    }
  }

  // Recursively extract all keys from nested translation object
  extractKeysFromObject(obj, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null) {
        this.extractKeysFromObject(value, fullKey);
      } else {
        this.existingKeys.add(fullKey);
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

      for (const pattern of CONFIG.patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const key = match[1];
          if (key && !key.includes('${')) {
            // Exclude template literals with variables
            fileKeys.add(key);
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
    for (const key of this.usedKeys) {
      if (!this.existingKeys.has(key)) {
        this.missingKeys.add(key);
      }
    }
  }

  // Generate report
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

      for (const [filePath, fileKeys] of this.filesWithTranslations) {
        const missingInFile = [...fileKeys].filter((key) => this.missingKeys.has(key));
        if (missingInFile.length > 0) {
          missingByFile.set(filePath, missingInFile);
        }
      }

      for (const [filePath, missingKeys] of missingByFile) {
        const relativePath = path.relative(process.cwd(), filePath);
        console.log(`\n📄 ${relativePath}:`);
        for (const key of missingKeys) {
          console.log(`   • ${key}`);
        }
      }

      console.log('\n💡 SUGGESTED ADDITIONS TO en-us.json:');
      console.log('{');

      const sortedMissing = Array.from(this.missingKeys).sort();
      for (const key of sortedMissing) {
        const value = this.generateDefaultValue(key);
        console.log(`  "${key}": "${value}",`);
      }
      console.log('}');
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

    // Exit with error code if missing translations found
    if (this.missingKeys.size > 0) {
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
      .trim();
  }

  // Run the complete scan
  run() {
    console.log('🚀 Starting translation scan...\n');

    this.loadExistingTranslations();
    this.scanFiles();
    this.findMissingTranslations();
    this.generateReport();
  }
}

// Check if glob package is available, try to install if not
try {
  require.resolve('glob');
} catch (e) {
  console.error('❌ "glob" package is required. Please install it with:');
  console.error('   npm install glob');
  console.error('   or yarn add glob');
  process.exit(1);
}

// Run the scanner
if (require.main === module) {
  const scanner = new TranslationScanner();
  scanner.run();
}

module.exports = TranslationScanner;
