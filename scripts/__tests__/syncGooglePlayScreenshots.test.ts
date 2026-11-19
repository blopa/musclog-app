import fs from 'node:fs';
import path from 'node:path';

const { DEVICES, LISTING, TARGETS, pngSize } = require('../sync-google-play-screenshots') as {
  DEVICES: Record<string, { folder: string; width: number; height: number }>;
  LISTING: string;
  TARGETS: Record<string, Array<[string, string]>>;
  pngSize: (file: string) => { width: number; height: number };
};

const MAX_BYTES = 8 * 1024 * 1024;

describe('sync-google-play-screenshots', () => {
  it('maps each device to distinct NN.png listing files starting at 01 with no gaps', () => {
    for (const [device, targets] of Object.entries(TARGETS)) {
      const files = targets.map(([, file]) => file);
      expect(new Set(files).size).toBe(files.length);
      files.forEach((file) => expect(file).toMatch(/^\d{2}\.png$/));
      const numbers = files.map((file) => Number(file.slice(0, 2))).sort((a, b) => a - b);
      expect(numbers).toEqual(numbers.map((_, index) => index + 1));
      expect(DEVICES[device]).toBeDefined();
    }
  });

  it('gives tablet-7 and tablet-10 the four targets 01 to 04', () => {
    for (const device of ['tablet-7', 'tablet-10']) {
      expect(TARGETS[device].map(([, file]) => file)).toEqual([
        '01.png',
        '02.png',
        '03.png',
        '04.png',
      ]);
    }
  });

  it('keeps the real en-US tablet folders to exactly the targeted NN.png files', () => {
    for (const [device, targets] of Object.entries(TARGETS)) {
      const folder = path.join(LISTING, DEVICES[device].folder);
      const numbered = fs.readdirSync(folder).filter((name) => /^\d{2}\.png$/.test(name));
      expect(numbered.sort()).toEqual(targets.map(([, file]) => file).sort());
    }
  });

  it('writes only PNGs of the device size, 24-bit RGB without alpha, under 8 MB', () => {
    for (const [device, { folder, width, height }] of Object.entries(DEVICES)) {
      const dir = path.join(LISTING, folder);
      for (const [, file] of TARGETS[device]) {
        const full = path.join(dir, file);
        expect(pngSize(full)).toEqual({ width, height });
        const bytes = fs.readFileSync(full);
        expect(bytes[25]).toBe(2);
        expect(fs.statSync(full).size).toBeLessThan(MAX_BYTES);
      }
    }
  });
});
