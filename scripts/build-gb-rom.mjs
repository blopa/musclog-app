// Builds the Musclog Game Boy Color ROM from gameboy/.
//
//   1. Ensure the GBDK-2020 toolchain is present (auto-download on first run).
//   2. Convert gameboy/assets/logo.png -> gameboy/src/logo.c via png2asset.
//   3. Compile + link src/*.c into gameboy/build/musclog.gbc via lcc.
//
// Usage: `npm run build-gb`

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
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
console.log('Compiling ROM ...');
const cSources = readdirSync(srcDir)
    .filter((name) => name.endsWith('.c'))
    .sort()
    .map((name) => join(srcDir, name));

run(lcc, [
    '-Wm-yC',
    '-Wm-yt0x10',
    '-Wm-ya4',
    '-Wm-yn"MUSCLOG"',
    '-o', romPath,
    ...cSources,
], gameboyDir);

const sizeKb = (statSync(romPath).size / 1024).toFixed(0);
console.log(`\n✓ Built ${romPath} (${sizeKb} KB)`);
console.log('  Open it in a Game Boy Color emulator (SameBoy / BGB / mGBA / Emulicious).');
