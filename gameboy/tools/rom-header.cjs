const { readFileSync, writeFileSync } = require('node:fs');

const GAME_CODE_OFFSET = 0x13f;
const ROM_REVISION_OFFSET = 0x14c;
const HEADER_CHECKSUM_OFFSET = 0x14d;
const GLOBAL_CHECKSUM_OFFSET = 0x14e;
const MINIMUM_ROM_SIZE = GLOBAL_CHECKSUM_OFFSET + 2;
const MUSCLOG_GAME_CODE = Buffer.from('MLOG', 'ascii');
const MUSCLOG_ROM_REVISION = 1;

function updateChecksums(rom) {
  let headerChecksum = 0;
  for (let offset = 0x134; offset <= ROM_REVISION_OFFSET; offset++) {
    headerChecksum = (headerChecksum - rom[offset] - 1) & 0xff;
  }
  rom[HEADER_CHECKSUM_OFFSET] = headerChecksum;

  let globalChecksum = 0;
  for (let offset = 0; offset < rom.length; offset++) {
    if (offset !== GLOBAL_CHECKSUM_OFFSET && offset !== GLOBAL_CHECKSUM_OFFSET + 1) {
      globalChecksum = (globalChecksum + rom[offset]) & 0xffff;
    }
  }
  rom[GLOBAL_CHECKSUM_OFFSET] = globalChecksum >> 8;
  rom[GLOBAL_CHECKSUM_OFFSET + 1] = globalChecksum & 0xff;
}

function applyMusclogRomHeader(rom) {
  if (!Buffer.isBuffer(rom) || rom.length < MINIMUM_ROM_SIZE) {
    throw new Error('Expected a Game Boy ROM buffer containing the complete cartridge header.');
  }

  MUSCLOG_GAME_CODE.copy(rom, GAME_CODE_OFFSET);
  rom[ROM_REVISION_OFFSET] = MUSCLOG_ROM_REVISION;
  updateChecksums(rom);
  return rom;
}

function patchMusclogRomHeaderFile(romPath) {
  const rom = applyMusclogRomHeader(readFileSync(romPath));
  writeFileSync(romPath, rom);
}

/**
 * CommonJS on purpose: `build-gb-rom.mjs` can import it and the Jest `node` project can
 * require it, whereas that project's React Native preset does not transform `.mjs`.
 */
module.exports = {
  applyMusclogRomHeader,
  patchMusclogRomHeaderFile,
};
