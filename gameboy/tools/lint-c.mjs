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

/** Finds the clang compiler binary and its builtin include directory.
 *  Returns { bin, incDir } where bin is the compiler to use in compile_commands.json
 *  and incDir is the builtin include path for stdint.h / stddef.h / stdbool.h.
 *  Needed on systems where glibc-devel is not installed (e.g. Fedora Kinoite). */
function findClang() {
    // Prefer versioned binaries (clang-22, clang-20…) then bare clang.
    const candidates = [];
    const binDir = '/usr/bin';
    if (existsSync(binDir)) {
        for (const f of readdirSync(binDir).sort().reverse()) {
            if (/^clang-\d+$/.test(f)) candidates.push(join(binDir, f));
        }
    }
    candidates.push('clang'); // also try PATH

    for (const bin of candidates) {
        const r = spawnSync(bin, ['--print-resource-dir'], { encoding: 'utf8' });
        if (r.status === 0 && r.stdout) {
            const resourceDir = r.stdout.trim();
            const incDir = join(resourceDir, 'include');
            if (existsSync(incDir)) return { bin, incDir };
        }
    }

    // Fallback: probe /usr/lib/clang/*/include without a known binary
    const clangLib = '/usr/lib/clang';
    if (existsSync(clangLib)) {
        for (const v of readdirSync(clangLib).sort().reverse()) {
            const incDir = join(clangLib, v, 'include');
            if (existsSync(incDir)) return { bin: 'clang', incDir };
        }
    }

    return { bin: 'clang', incDir: null };
}

function collectSourceFiles() {
    return collectFilesRecursive(srcDir, '.c');
}

function collectFilesRecursive(rootDir, extension) {
    const files = [];

    for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
        const fullPath = join(rootDir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFilesRecursive(fullPath, extension));
            continue;
        }
        if (entry.isFile() && entry.name.endsWith(extension)) {
            files.push(fullPath);
        }
    }

    return files.sort();
}

function collectIncludeDirs(rootDir) {
    const dirs = [rootDir];

    for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        dirs.push(...collectIncludeDirs(join(rootDir, entry.name)));
    }

    return dirs.sort();
}

function generateCompileCommands(sourceFiles) {
    // clang-tidy needs a compile_commands.json to know which flags to use.
    // We generate a minimal one: -std=c99, stub include path first so our
    // SDCC-free headers shadow the real GBDK ones, then every project include dir.
    const includeDirs = collectIncludeDirs(srcDir);
    const { bin: clangBin, incDir: clangBuiltinInc } = findClang();

    const entries = sourceFiles.map((file) => ({
        directory: srcDir,
        file,
        command: [
            clangBin,
            // Use gnu99 instead of c99: SDCC allows void main(); strict C99 does not.
            '-std=gnu99',
            // Stubs must come before any system path so clang picks our
            // SDCC-free <gb/gb.h> etc. instead of the real GBDK ones.
            `-I${stubsDir}`,
            ...includeDirs.map((dir) => `-I${dir}`),
            // Clang's own builtin headers (stdint.h, stddef.h, stdbool.h).
            // Required on systems where glibc-devel is not installed (e.g. Fedora Kinoite).
            ...(clangBuiltinInc ? [`-isystem${clangBuiltinInc}`] : []),
            // Silence warnings that are expected in GBC embedded code.
            '-Wno-unused-parameter',
            // GBC's main() is void-returning (SDCC convention); clang requires int.
            '-Wno-main',
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
        console.log('No .c files found under gameboy/src — nothing to lint.');
        return;
    }

    const compileCommandsPath = generateCompileCommands(sourceFiles);
    console.log(`Generated ${relative(repoRoot, compileCommandsPath)}`);

    const args = [
        `--config-file=${join(gameboyDir, '.clang-tidy')}`,
        `-p=${buildDir}`,
        ...(fix ? ['--fix', '--fix-errors'] : []),
        '--warnings-as-errors=*',
        // GBC uses void main() (SDCC convention). Pass -Wno-main directly so
        // clang-tidy's driver honours it regardless of compile_commands.json parsing.
        '--extra-arg=-Wno-main',
        ...sourceFiles,
    ];

    console.log(`Running clang-tidy on gameboy/src recursively (${sourceFiles.length} files)...`);
    execFileSync('clang-tidy', args, {
        cwd: repoRoot,
        stdio: 'inherit',
    });
    console.log('clang-tidy passed.');
}

run();
