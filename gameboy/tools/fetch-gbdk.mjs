// Downloads the GBDK-2020 toolchain into gameboy/.gbdk/ (gitignored).
// Idempotent: if a usable `lcc` is already present, it does nothing.
//
// Run directly (`npm run gb:setup`) or let `npm run build-gb` invoke it on first build.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { arch, platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GBDK_VERSION = '4.5.0'; // pinned fallback when the GitHub API is unreachable

const gameboyDir = join(fileURLToPath(import.meta.url), '..', '..');
const gbdkDir = join(gameboyDir, '.gbdk');
export const lccPath = join(gbdkDir, 'bin', 'lcc');

// Map the host platform/arch to a GBDK release asset name.
function assetForHost() {
    const p = platform();
    const a = arch();
    if (p === 'linux') return a === 'arm64' ? 'gbdk-linux-arm64.tar.gz' : 'gbdk-linux64.tar.gz';
    if (p === 'darwin') return a === 'arm64' ? 'gbdk-macos-arm64.tar.gz' : 'gbdk-macos.tar.gz';
    throw new Error(
        `Unsupported platform "${p}/${a}" for auto-download. Install GBDK-2020 manually and ` +
            `extract it into ${gbdkDir} (so that ${lccPath} exists).`
    );
}

// Resolve the newest release tag, falling back to the pinned version offline.
function resolveVersion() {
    try {
        const json = execFileSync(
            'curl',
            ['-sSfL', 'https://api.github.com/repos/gbdk-2020/gbdk-2020/releases/latest'],
            { encoding: 'utf8' }
        );
        const tag = JSON.parse(json).tag_name;
        return typeof tag === 'string' && tag.length > 0 ? tag : GBDK_VERSION;
    } catch {
        console.warn(`Could not reach GitHub API; using pinned GBDK ${GBDK_VERSION}.`);
        return GBDK_VERSION;
    }
}

export function ensureGbdk() {
    if (existsSync(lccPath)) return gbdkDir;

    const asset = assetForHost();
    const version = resolveVersion();
    const url = `https://github.com/gbdk-2020/gbdk-2020/releases/download/${version}/${asset}`;
    const archive = join(tmpdir(), `gbdk-${version}-${process.pid}.tar.gz`);

    console.log(`Downloading GBDK-2020 ${version} (${asset})...`);
    execFileSync('curl', ['-sSfL', url, '-o', archive], { stdio: 'inherit' });

    // The tarball contains a top-level `gbdk/` folder; strip it so bin/ lands directly in .gbdk/.
    mkdirSync(gbdkDir, { recursive: true });
    console.log(`Extracting into ${gbdkDir}...`);
    execFileSync('tar', ['-xzf', archive, '--strip-components=1', '-C', gbdkDir], { stdio: 'inherit' });
    rmSync(archive, { force: true });

    if (!existsSync(lccPath)) {
        throw new Error(`Extraction finished but ${lccPath} is missing — the archive layout may have changed.`);
    }
    console.log('GBDK-2020 ready.');
    return gbdkDir;
}

// Allow running this file directly.
if (import.meta.url === `file://${process.argv[1]}`) {
    ensureGbdk();
}
