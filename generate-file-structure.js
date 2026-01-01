#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const outputFile = path.join(process.cwd(), 'file-structure.md');

// Directories to ignore at the root level
const ignoredRootDirs = new Set([
    '.expo',
    '.git',
    '.idea',
    'android',
    'dist',
    'dumps',
    'ios',
    'node_modules',
    'test-results',
    'tests',
]);

function walk(dir, depth = 0, isRoot = false) {
    let output = '';
    const indent = '  '.repeat(depth);
    let entries;

    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        console.error(`Cannot read directory: ${dir}`);
        return '';
    }

    entries.sort((a, b) => {
        // Directories first, then files; both sorted alphabetically
        if (a.isDirectory() && !b.isDirectory()) {
            return -1;
        }

        if (!a.isDirectory() && b.isDirectory()) {
            return 1;
        }

        return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // At root level, skip ignored directories
        if (isRoot && entry.isDirectory() && ignoredRootDirs.has(entry.name)) {
            continue;
        }

        if (entry.isDirectory()) {
            output += `${indent}- 📁 ${entry.name}\n`;
            output += walk(fullPath, depth + 1);
        } else {
            output += `${indent}- 📄 ${entry.name}\n`;
        }
    }

    return output;
}

const startDir = process.cwd();
const tree = `# 📂 File Structure for ${path.basename(startDir)}\n\n` + walk(startDir, 0, true);

try {
    fs.writeFileSync(outputFile, tree, 'utf8');
    console.log(`✅ File structure saved to ${outputFile}`);
} catch (e) {
    console.error(`❌ Failed to write file: ${e.message}`);
}
