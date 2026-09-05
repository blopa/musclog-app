import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// `theme.registry.js` is plain CommonJS shared with Tailwind's Node process, and the
// generator reads it the same way.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DEFAULT_THEME_BY_MODE, THEME_IDS } = require('../../theme.registry');

const repositoryRoot = join(__dirname, '..', '..');

describe('Game Boy themes', () => {
  it('carries every app theme, in registry order, with the app default first', () => {
    const generatedHeader = readFileSync(
      join(repositoryRoot, 'gameboy/src/generated/themes.h'),
      'utf8'
    );
    const generatedSource = readFileSync(
      join(repositoryRoot, 'gameboy/src/generated/themes.c'),
      'utf8'
    );

    // The stored SRAM value is a theme's index in this table, so a reordered or dropped
    // theme silently repoints an existing cartridge at a different one.
    const generatedIds = [
      ...generatedSource.matchAll(/\/\* (kinetic-[a-z-]+) \((?:dark|light)\)/g),
    ].map(([, id]) => id);
    expect(generatedIds).toEqual(THEME_IDS);
    expect(generatedHeader).toContain(`#define GB_THEME_COUNT ${THEME_IDS.length}u`);
    expect(generatedHeader).toContain(
      `#define GB_THEME_DEFAULT ${THEME_IDS.indexOf(DEFAULT_THEME_BY_MODE.dark)}u`
    );
  });

  it('names every theme within the width of the settings value column', () => {
    const generatedSource = readFileSync(
      join(repositoryRoot, 'gameboy/src/generated/themes.c'),
      'utf8'
    );
    const nameTable = generatedSource.slice(generatedSource.indexOf('gb_theme_names'));
    const names = [...nameTable.matchAll(/"([^"]+)"/g)].map(([, name]) => name);

    expect(names).toHaveLength(THEME_IDS.length);
    for (const name of names) {
      expect(name).toMatch(/^[A-Z ]{1,8}$/);
    }
  });
});
