// Formats (or checks formatting of) the Game Boy C sources with clang-format.
//
// Usage:
//   npm run gb:format          — format in-place
//   npm run gb:format-check    — check only, exit 1 if any file differs

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..', '..');
const gameboyDir = join(repoRoot, 'gameboy');
const srcDir = join(gameboyDir, 'src');

const checkOnly = process.argv.includes('--check');

function findClangFormat() {
    // Prefer the npm-bundled binary so the version is pinned.
    const require = createRequire(import.meta.url);
    try {
        const pkg = require.resolve('clang-format');
        // The package exposes its binary path via the main module.
        const mod = require('clang-format');
        if (mod.location && existsSync(mod.location)) return mod.location;
    } catch (_) {
        // fall through
    }

    // Fall back to the npx-installed wrapper in node_modules/.bin.
    const binWrapper = join(repoRoot, 'node_modules', '.bin', 'clang-format');
    if (existsSync(binWrapper)) return binWrapper;

    // Last resort: system clang-format.
    const r = spawnSync('sh', ['-lc', 'command -v clang-format'], { stdio: 'pipe', encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();

    throw new Error(
        'clang-format not found. Install it with: npm install clang-format',
    );
}

function collectFiles(dir, ext) {
    const files = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFiles(full, ext));
        } else if (entry.isFile() && entry.name.endsWith(ext)) {
            files.push(full);
        }
    }
    return files.sort();
}

function run() {
    const clangFormat = findClangFormat();
    const styleFlag = `--style=file:${join(gameboyDir, '.clang-format')}`;
    const sourceFiles = [
        ...collectFiles(srcDir, '.c'),
        ...collectFiles(srcDir, '.h'),
    ];

    if (sourceFiles.length === 0) {
        console.log('No C/H files found under gameboy/src — nothing to format.');
        return;
    }

    if (checkOnly) {
        console.log(`Checking clang-format on gameboy/src (${sourceFiles.length} files)...`);
        const result = spawnSync(
            process.execPath,
            [clangFormat, '--dry-run', '--Werror', styleFlag, ...sourceFiles],
            { cwd: repoRoot, stdio: 'inherit' },
        );
        if (result.status !== 0) {
            console.error(
                'clang-format: formatting violations found. Run "npm run gb:format" to fix.',
            );
            process.exit(1);
        }
        console.log('clang-format check passed.');
    } else {
        console.log(`Formatting gameboy/src in-place (${sourceFiles.length} files)...`);
        execFileSync(process.execPath, [clangFormat, '-i', styleFlag, ...sourceFiles], {
            cwd: repoRoot,
            stdio: 'inherit',
        });
        const rel = (f) => relative(repoRoot, f);
        console.log(`Formatted ${sourceFiles.length} files.`);
    }
}

run();
