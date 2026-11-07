import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { LOGGY_PALETTE, POSTER_GROUNDS } from '@/constants/loggyPalette';

const POSES = join(__dirname, '..', '..', 'assets', 'avatars', 'loggy-poses');

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('LOGGY_PALETTE', () => {
  it("names colours from Loggy's artwork, not new ones", () => {
    const art = readdirSync(POSES)
      .filter((name) => name.endsWith('.svg'))
      .map((name) => readFileSync(join(POSES, name), 'utf8').toLowerCase())
      .join('\n');

    for (const color of Object.values(LOGGY_PALETTE)) {
      expect(art).toContain(color);
    }
  });
});

describe('POSTER_GROUNDS', () => {
  it.each(Object.entries(POSTER_GROUNDS))('%s carries body text at AA', (_name, ground) => {
    expect(contrast(ground.ink, ground.background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(POSTER_GROUNDS))('%s shows its highlight at 3:1', (_name, ground) => {
    expect(contrast(ground.highlight, ground.background)).toBeGreaterThanOrEqual(3);
  });

  it('never grounds a poster on the green Loggy is drawn in', () => {
    const grounds = Object.values(POSTER_GROUNDS).map(({ background }) => background);

    expect(grounds).not.toContain(LOGGY_PALETTE.green);
    expect(grounds).not.toContain(LOGGY_PALETTE.teal);
  });
});
