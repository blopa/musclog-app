import { GOOGLE_PLAY_URL } from '@/components/website/storeLinks';
import { qrCodeSvgData } from '@/components/website/qrCodeSvg';

describe('qrCodeSvgData', () => {
  it('returns a square module grid with one path segment per dark module', () => {
    const { size, path } = qrCodeSvgData(GOOGLE_PLAY_URL);

    // QR sizes are 17 + 4 * version, so any valid code is at least 21 modules wide.
    expect(size).toBeGreaterThanOrEqual(21);
    expect((size - 17) % 4).toBe(0);
    expect(path.startsWith('M')).toBe(true);
    expect(path.split('M').length - 1).toBeGreaterThan(size);
  });

  it('is deterministic and depends on the encoded text', () => {
    expect(qrCodeSvgData(GOOGLE_PLAY_URL)).toEqual(qrCodeSvgData(GOOGLE_PLAY_URL));
    expect(qrCodeSvgData('https://example.com').path).not.toBe(qrCodeSvgData(GOOGLE_PLAY_URL).path);
  });

  it('draws only unit squares inside the grid', () => {
    const { size, path } = qrCodeSvgData(GOOGLE_PLAY_URL);

    for (const segment of path.split('M').slice(1)) {
      const match = /^(\d+),(\d+)h1v1h-1z$/.exec(segment);
      expect(match).not.toBeNull();
      expect(Number(match![1])).toBeLessThan(size);
      expect(Number(match![2])).toBeLessThan(size);
    }
  });
});
