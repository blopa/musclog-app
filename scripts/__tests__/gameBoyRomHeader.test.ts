import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// `gameboy/` is outside the app's tsconfig, so this is a plain require rather than an
// import with a hand-written type assertion that nothing would ever check against the
// real signature.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applyMusclogRomHeader } = require('../../gameboy/tools/rom-header.cjs');

const HEADER_CHECKSUM_OFFSET = 0x14d;
const GLOBAL_CHECKSUM_OFFSET = 0x14e;

describe('Game Boy ROM header patch', () => {
  it('runs after linking without deprecated makebin byte patches', () => {
    const buildScript = readFileSync(
      join(__dirname, '../../gameboy/tools/build-gb-rom.mjs'),
      'utf8'
    );

    expect(buildScript).toContain('patchMusclogRomHeaderFile(romPath);');
    expect(buildScript).not.toMatch(/['"]-Wm-yp/);
  });

  it('writes the Musclog game code and revision with valid cartridge checksums', () => {
    const rom = Buffer.alloc(32 * 1024);
    for (let offset = 0; offset < rom.length; offset++) rom[offset] = offset & 0xff;

    expect(applyMusclogRomHeader(rom)).toBe(rom);
    expect(rom.subarray(0x13f, 0x143).toString('ascii')).toBe('MLOG');
    expect(rom[0x14c]).toBe(2);

    let headerChecksum = 0;
    for (let offset = 0x134; offset <= 0x14c; offset++) {
      headerChecksum = (headerChecksum - rom[offset] - 1) & 0xff;
    }
    expect(rom[HEADER_CHECKSUM_OFFSET]).toBe(headerChecksum);

    const storedGlobalChecksum = rom.readUInt16BE(GLOBAL_CHECKSUM_OFFSET);
    let calculatedGlobalChecksum = 0;
    for (let offset = 0; offset < rom.length; offset++) {
      if (offset !== GLOBAL_CHECKSUM_OFFSET && offset !== GLOBAL_CHECKSUM_OFFSET + 1) {
        calculatedGlobalChecksum = (calculatedGlobalChecksum + rom[offset]) & 0xffff;
      }
    }
    expect(storedGlobalChecksum).toBe(calculatedGlobalChecksum);
  });

  it('rejects data that cannot contain a complete cartridge header', () => {
    expect(() => applyMusclogRomHeader(Buffer.alloc(0x14f))).toThrow(
      'Expected a Game Boy ROM buffer containing the complete cartridge header.'
    );
  });
});
