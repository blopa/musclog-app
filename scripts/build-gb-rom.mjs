// Builds the Musclog Game Boy Color ROM from gameboy/.
//
//   1. Ensure the GBDK-2020 toolchain is present (auto-download on first run).
//   2. Convert gameboy/assets/logo.png -> gameboy/src/logo.c via png2asset.
//   3. Compile + link src/*.c into gameboy/build/musclog.gbc via lcc.
//   4. Check the linker map; bank overflows produce ROMs that "build" but crash
//      when switchable banks are mapped.
//
// Usage: `npm run gb:build`

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ensureGbdk } from '../gameboy/tools/fetch-gbdk.mjs';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..');
const gameboyDir = join(repoRoot, 'gameboy');
const srcDir = join(gameboyDir, 'src');
const buildDir = join(gameboyDir, 'build');
const logoPng = join(gameboyDir, 'assets', 'logo.png');
const romPath = join(buildDir, 'musclog.gbc');

function run(bin, args, cwd) {
    execFileSync(bin, args, { cwd, stdio: 'inherit' });
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

if (!existsSync(logoPng)) {
    throw new Error(`Missing ${logoPng}. Run "npm run gb:prepare-logo" first to generate it.`);
}

mkdirSync(srcDir, { recursive: true });
mkdirSync(buildDir, { recursive: true });

// 2. Logo -> C tile/map/palette data (CGB attributes, fixed palette order, no tile flipping).
console.log('Converting logo.png -> src/logo.c ...');
run(png2asset, [
    logoPng,
    '-c', join(srcDir, 'logo.c'),
    '-map',
    '-use_map_attributes',
    '-keep_palette_order',
    '-noflip',
]);

// 3. Compile + link. -Wm-yC = Game Boy Color only; -Wm-yt0x10 = MBC3 + Timer + RAM + battery.
//    MBC3 provides the real-time clock (RTC) registers used for calendar date tracking.
//    -Wm-ya4 sets the RAM-size header to four 8 KB SRAM banks so emulators/flash carts
//    actually persist the onboarding profile.
//    -Wm-yo8 reserves eight 16 KB ROM banks (128 KB). The hardcoded food tables
//    live in dedicated banks (USDA in bank 2, common foods in bank 3), and the
//    generated exercise table lives in bank 6; SWITCH_ROM() is required to read them.
//    -Wl-m emits gameboy/build/musclog.map so the build can catch bank overflows.
console.log('Compiling ROM ...');
const cSources = readdirSync(srcDir)
    .filter((name) => name.endsWith('.c'))
    .sort()
    .map((name) => join(srcDir, name));

run(lcc, [
    '-Wm-yC',
    '-Wm-yt0x10',
    '-Wm-ya4',
    '-Wm-yo8',
    '-Wm-yn"MUSCLOG"',
    '-Wl-m',
    '-o', romPath,
    ...cSources,
], gameboyDir);

const mapPath = join(buildDir, 'musclog.map');
checkBankLayout(mapPath);

const sizeKb = (statSync(romPath).size / 1024).toFixed(0);
console.log(`\n✓ Built ${romPath} (${sizeKb} KB)`);
console.log('  Open it in a Game Boy Color emulator (SameBoy / BGB / mGBA / Emulicious).');
