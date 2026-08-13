import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..', '..');

function source(path: string): string {
  return readFileSync(join(repositoryRoot, path), 'utf8');
}

describe('iOS simulator framework patches', () => {
  it('runs CocoaPods once and disables simulator patching for device prebuilds', () => {
    const packageJson = JSON.parse(source('package.json')) as {
      scripts: Record<string, string>;
    };

    for (const script of ['prebuild-ios', 'prebuild-ios-simulator', 'prebuild:ios']) {
      expect(packageJson.scripts[script]).toBe('expo prebuild -p ios --clean');
      expect(packageJson.scripts[script]).not.toContain('pod install');
    }
    expect(packageJson.scripts['prebuild-ios-device']).toBe(
      'MUSCLOG_IOS_SIMULATOR_BUILD_FIX=0 expo prebuild -p ios --clean'
    );
  });

  it('discovers installed MLKit frameworks instead of warning about absent language pods', () => {
    const patcher = source('scripts/fix_mlkit_simulator.py');

    expect(patcher).toContain('"MLKit*", "Frameworks", "*.framework"');
    expect(patcher).not.toContain('MLKitTextRecognitionChinese');
    expect(patcher).toContain('already simulator-compatible');
  });

  it('keeps the Mach-O patch idempotent for individual binaries and AR archives', () => {
    const python = String.raw`
import struct
from scripts.ios_simulator_binary import (
    LC_BUILD_VERSION,
    LC_VERSION_MIN_IPHONEOS,
    PLATFORM_IOS,
    patch_binary_data,
)

def macho():
    legacy = struct.pack('<IIII', LC_VERSION_MIN_IPHONEOS, 16, 0, 0)
    build = struct.pack('<IIIIII', LC_BUILD_VERSION, 24, PLATFORM_IOS, 0, 0, 0)
    header = struct.pack('<IIIIIIII', 0xFEEDFACF, 0, 0, 1, 2, len(legacy) + len(build), 0, 0)
    return header + legacy + build

def archive_member(name, contents):
    name_bytes = name.encode('ascii')
    member = name_bytes + contents
    header = (
        f'#1/{len(name_bytes)}'.ljust(16)
        + '0'.ljust(12)
        + '0'.ljust(6)
        + '0'.ljust(6)
        + '100644'.ljust(8)
        + str(len(member)).ljust(10)
        + '\x60\n'
    ).encode('ascii')
    result = header + member
    return result + (b'\n' if len(result) % 2 else b'')

direct = bytearray(macho())
first = patch_binary_data(direct)
assert first.macho_members == 1
assert first.patched_commands == 2
second = patch_binary_data(direct)
assert second.patched_commands == 0
assert second.neutralized_commands == 1
assert second.simulator_commands == 1

archive = bytearray(b'!<arch>\n' + archive_member('fixture.o', macho()))
archive_first = patch_binary_data(archive)
assert archive_first.macho_members == 1
assert archive_first.patched_commands == 2
assert patch_binary_data(archive).patched_commands == 0
`;

    expect(() =>
      execFileSync('python3', ['-B', '-c', python], {
        cwd: repositoryRoot,
        stdio: 'pipe',
      })
    ).not.toThrow();
  });

  it('runs imported patch code without leaving Python cache files in the repository', () => {
    expect(source('plugins/withIosSimulatorBuildFix.js')).toContain(
      "system('python3', '-B', script_path)"
    );
    expect(source('ios/Podfile')).toContain("system('python3', '-B', script_path)");
  });
});
