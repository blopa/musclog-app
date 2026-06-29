// Builds the Musclog Game Boy Color ROM from gameboy/.
//
//   1. Ensure the GBDK-2020 toolchain is present (auto-download on first run).
//   2. Convert gameboy/assets/*.png -> gameboy/src/generated/*.c via png2asset.
//   3. Compile + link src/**/*.c into gameboy/build/musclog.gbc via lcc.
//   4. Check the linker map; bank overflows produce ROMs that "build" but crash
//      when switchable banks are mapped.
//
// Usage: `npm run gb:build`

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ensureGbdk } from './fetch-gbdk.mjs';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..', '..');
const gameboyDir = join(repoRoot, 'gameboy');
const srcDir = join(gameboyDir, 'src');
const generatedDir = join(srcDir, 'generated');
const buildDir = join(gameboyDir, 'build');
const logoPng = join(gameboyDir, 'assets', 'logo.png');
const backgroundPng = join(gameboyDir, 'assets', 'gb_background.png');
const romPath = join(buildDir, 'musclog.gbc');

// The start-screen art is the largest single asset; it lives in its own ROM bank
// (8) together with the start-screen code so the code can read it directly without
// SWITCH_ROM. Bank 0 is full, so this must NOT go to the default (fixed) bank.
const BACKGROUND_BANK = 8;

function run(bin, args, cwd) {
    execFileSync(bin, args, { cwd, stdio: 'inherit' });
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

    return dirs;
}

const gbdkDir = ensureGbdk();
const png2asset = join(gbdkDir, 'bin', 'png2asset');
const lcc = join(gbdkDir, 'bin', 'lcc');

function parseMapAreas(mapPath) {
    const areas = [];
    const areaPattern = /^(_[A-Z][A-Z0-9_]*|\.\s+\.ABS\.)\s+([0-9A-F]{8})\s+([0-9A-F]{8})/;

    for (const line of readFileSync(mapPath, 'utf8').split('\n')) {
        const match = line.match(areaPattern);
        if (!match) continue;

        areas.push({
            name: match[1].trim(),
            addr: Number.parseInt(match[2], 16),
            size: Number.parseInt(match[3], 16),
        });
    }

    return areas;
}

function checkBankLayout(mapPath) {
    const areas = parseMapAreas(mapPath);
    const fixedAreaNames = new Set(['_CODE', '_HOME', '_INITIALIZER', '_GSINIT', '_GSFINAL']);
    const fixedLimit = 0x4000;
    const warnings = [];
    let fixedEnd = 0;

    for (const area of areas) {
        const end = area.addr + area.size;

        if (fixedAreaNames.has(area.name)) {
            fixedEnd = Math.max(fixedEnd, end);
            if (area.size !== 0 && end > fixedLimit) {
                warnings.push(
                    `${area.name} is outside bank 0: 0x${area.addr.toString(16)} -> 0x${(end - 1).toString(16)}`,
                );
            }
        }

        if (/^_CODE_\d+$/.test(area.name) && area.size > fixedLimit) {
            warnings.push(`${area.name} exceeds 16 KB: ${area.size} bytes`);
        }
    }

    console.log(`\nBank layout: ROM_0 uses ${fixedEnd} / ${fixedLimit} bytes`);
    for (const area of areas.filter((candidate) => /^_CODE_\d+$/.test(candidate.name))) {
        console.log(`Bank layout: ${area.name} uses ${area.size} / ${fixedLimit} bytes`);
    }

    if (warnings.length !== 0) {
        throw new Error(`GB ROM bank layout is invalid:\n${warnings.join('\n')}`);
    }
}

function assertGeneratedBackgroundFits(tileHeaderPath) {
    const header = readFileSync(tileHeaderPath, 'utf8');
    const match = header.match(/^#define gb_background_TILE_COUNT\s+(\d+)$/m);
    if (!match) {
        throw new Error(`Could not read gb_background_TILE_COUNT from ${tileHeaderPath}`);
    }

    const tileCount = Number.parseInt(match[1], 10);
    if (tileCount > 256) {
        throw new Error(
            `The title background generated ${tileCount} unique tiles, but the start screen can address only 256. ` +
                'Simplify assets/gb_background.png slightly, then run "npm run gb:prepare-bg" and "npm run gb:build" again.',
        );
    }
}

if (!existsSync(logoPng)) {
    throw new Error(`Missing ${logoPng}. Run "npm run gb:prepare-logo" first to generate it.`);
}

if (!existsSync(backgroundPng)) {
    throw new Error(`Missing ${backgroundPng}. Run "npm run gb:prepare-bg" first to generate it.`);
}

mkdirSync(srcDir, { recursive: true });
mkdirSync(generatedDir, { recursive: true });
mkdirSync(buildDir, { recursive: true });

// 2. Logo -> generated C tile/map/palette data (CGB attributes, fixed palette order, no tile flipping).
console.log('Converting logo.png -> src/generated/logo.c ...');
run(png2asset, [
    logoPng,
    '-c', join(generatedDir, 'logo.c'),
    '-map',
    '-use_map_attributes',
    '-keep_palette_order',
    '-noflip',
]);

// 2b. Start-screen art -> C data, pinned to BACKGROUND_BANK so it co-locates with
// start_screen.c (which uses the same "#pragma bank 8") and stays out of the full bank 0.
// Let png2asset dedupe flipped tiles; the start screen writes map attributes, so
// the flip flags survive alongside the CGB palette and VRAM-bank attributes.
console.log('Converting gb_background.png -> src/generated/gb_background.c ...');
run(png2asset, [
    backgroundPng,
    '-c', join(generatedDir, 'gb_background.c'),
    '-map',
    '-use_map_attributes',
    '-keep_palette_order',
    '-b', String(BACKGROUND_BANK),
]);
assertGeneratedBackgroundFits(join(generatedDir, 'gb_background.h'));

// 3. Compile + link. -Wm-yC = Game Boy Color only; -Wm-yt0x10 = MBC3 + Timer + RAM + battery.
//    MBC3 provides the real-time clock (RTC) registers used for calendar date tracking.
//    -Wm-ya4 sets the RAM-size header to four 8 KB SRAM banks so emulators/flash carts
//    actually persist the onboarding profile.
//    -Wm-yo16 reserves sixteen 16 KB ROM banks (256 KB). The hardcoded food tables
//    live in dedicated banks (USDA in bank 2, common foods in bank 3), the generated
//    exercise table lives in bank 6 (SWITCH_ROM() is required to read those), and the
//    start-screen art + code live in bank 8 (read directly, co-located in that bank).
//
//    Cartridge product code: CGB-MLOG-HOL (modelled on Nintendo's DMG-TR-USA scheme):
//      - CGB     : Game Boy Color title, set by -Wm-yC.
//      - MLOG    : 4-char manufacturer/game code, written into header 0x13F-0x142
//                  ("MLOG" = 0x4D 0x4C 0x4F 0x47) via -Wm-yp patches. This field sits
//                  just past the "MUSCLOG" title (0x134-0x13A) and is otherwise blank.
//      - HOL     : Netherlands (non-Japanese) region. The header only carries a
//                  Japanese / non-Japanese destination flag (0x14A); -Wm-yj sets it
//                  to 0x01 (non-Japanese), the closest the hardware encodes for HOL.
//    -Wm-yp0x14C=0 sets the mask-ROM version/revision byte (0x14C) to 0 — i.e. first
//    revision, so the code reads CGB-MLOG-HOL with no trailing "-1". (makebin has no
//    GameBoy version flag, so this is done with a header patch.)
//    -Wl-m emits gameboy/build/musclog.map so the build can catch bank overflows.
console.log('Compiling ROM ...');
const cSources = collectFilesRecursive(srcDir, '.c');
const includeDirs = collectIncludeDirs(srcDir).sort();

run(lcc, [
    '-Wm-yC',
    '-Wm-yt0x10',
    '-Wm-ya4',
    '-Wm-yo16',
    '-Wm-yn"MUSCLOG"',
    '-Wm-yj',
    '-Wm-yp0x13F=0x4D', // 'M'
    '-Wm-yp0x140=0x4C', // 'L'
    '-Wm-yp0x141=0x4F', // 'O'
    '-Wm-yp0x142=0x47', // 'G'
    '-Wm-yp0x14C=0x00', // revision 0 (no trailing "-1")
    '-Wl-m',
    ...includeDirs.map((dir) => `-I${dir}`),
    '-o', romPath,
    ...cSources,
], gameboyDir);

const mapPath = join(buildDir, 'musclog.map');
checkBankLayout(mapPath);

const sizeKb = (statSync(romPath).size / 1024).toFixed(0);
console.log(`\n✓ Built ${romPath} (${sizeKb} KB)`);
console.log('  Open it in a Game Boy Color emulator (SameBoy / BGB / mGBA / Emulicious).');
