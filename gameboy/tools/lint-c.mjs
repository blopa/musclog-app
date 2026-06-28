// Runs clang-tidy over the Game Boy C sources.
//
// Usage:
//   npm run gb:lint           — report findings
//   npm run gb:lint -- --fix  — auto-fix where possible

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..', '..');
const gameboyDir = join(repoRoot, 'gameboy');
const srcDir = join(gameboyDir, 'src');
const stubsDir = join(gameboyDir, 'tools', 'lint-stubs');
const buildDir = join(gameboyDir, 'build');

function commandExists(command) {
    const result = spawnSync('sh', ['-lc', `command -v ${command}`], { stdio: 'ignore' });
    return result.status === 0;
}

function readOsRelease() {
    const osReleasePath = '/etc/os-release';
    if (!existsSync(osReleasePath)) {
        return new Map();
    }

    const values = new Map();
    for (const line of readFileSync(osReleasePath, 'utf8').split('\n')) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!match) continue;

        let value = match[2];
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        }
        values.set(match[1], value);
    }
    return values;
}

function installHint() {
    const osRelease = readOsRelease();
    const id = osRelease.get('ID');
    const variantId = osRelease.get('VARIANT_ID');

    if (id === 'fedora' && variantId === 'kinoite') {
        return 'On Fedora Kinoite, try "sudo rpm-ostree install clang-tools-extra" and reboot, or install it inside a toolbox/distrobox.';
    }
    if (id === 'fedora' || commandExists('dnf')) {
        return 'Try: sudo dnf install clang-tools-extra';
    }
    if (commandExists('apt')) {
        return 'Try: sudo apt install clang-tidy';
    }
    if (commandExists('pacman')) {
        return 'Try: sudo pacman -S clang';
    }
    if (commandExists('zypper')) {
        return 'Try: sudo zypper install clang-tools';
    }
    if (commandExists('apk')) {
        return 'Try: sudo apk add clang-extra-tools';
    }
    if (commandExists('brew')) {
        return 'Try: brew install llvm';
    }

    return 'Install "clang-tidy" with your system package manager, then run "npm run gb:lint" again.';
}

function ensureClangTidyAvailable() {
    const result = spawnSync('clang-tidy', ['--version'], { stdio: 'ignore' });
    if (result.status === 0) {
        return;
    }

    throw new Error(
        `clang-tidy is not installed or not on PATH. ${installHint()}`,
    );
}

function collectSourceFiles() {
    return readdirSync(srcDir)
        .filter((f) => f.endsWith('.c'))
        .map((f) => join(srcDir, f));
}

function generateCompileCommands(sourceFiles) {
    // clang-tidy needs a compile_commands.json to know which flags to use.
    // We generate a minimal one: -std=c99, stub include path first so our
    // SDCC-free headers shadow the real GBDK ones, then the src dir.
    const entries = sourceFiles.map((file) => ({
        directory: srcDir,
        file,
        command: [
            'clang',
            '-std=c99',
            // Stubs must come before any system path so clang picks our
            // SDCC-free <gb/gb.h> etc. instead of the real GBDK ones.
            `-I${stubsDir}`,
            `-I${srcDir}`,
            // Silence warnings that are expected in GBC embedded code.
            '-Wno-unused-parameter',
            '-c',
            file,
        ].join(' '),
    }));

    const outPath = join(buildDir, 'compile_commands.json');
    writeFileSync(outPath, JSON.stringify(entries, null, 2));
    return outPath;
}

function run() {
    ensureClangTidyAvailable();

    const extraArgs = process.argv.slice(2);
    const fix = extraArgs.includes('--fix');

    if (!existsSync(buildDir)) {
        execFileSync('mkdir', ['-p', buildDir]);
    }

    const sourceFiles = collectSourceFiles();
    if (sourceFiles.length === 0) {
        console.log('No .c files found in gameboy/src — nothing to lint.');
        return;
    }

    const compileCommandsPath = generateCompileCommands(sourceFiles);
    console.log(`Generated ${relative(repoRoot, compileCommandsPath)}`);

    const args = [
        `--config-file=${join(gameboyDir, '.clang-tidy')}`,
        `-p=${buildDir}`,
        ...(fix ? ['--fix', '--fix-errors'] : []),
        '--warnings-as-errors=*',
        ...sourceFiles,
    ];

    console.log(`Running clang-tidy on gameboy/src (${sourceFiles.length} files)...`);
    execFileSync('clang-tidy', args, {
        cwd: repoRoot,
        stdio: 'inherit',
    });
    console.log('clang-tidy passed.');
}

run();
