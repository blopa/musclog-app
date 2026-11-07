import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { sampleLoggyLayer } from '@/utils/loggyAnimation';

const { generateAll, readAnimation, SOURCE_DIR } =
  require('../../scripts/generate-loggy-animated') as {
    generateAll: () => Promise<Record<string, string>>;
    readAnimation: (css: string) => {
      loopMs: number;
      layers: Record<string, Parameters<typeof sampleLoggyLayer>[0]>;
    };
    SOURCE_DIR: string;
  };

const svgs = readdirSync(SOURCE_DIR).filter((name) => name.endsWith('.svg'));

function animationOf(svg: string) {
  const source = readFileSync(join(SOURCE_DIR, svg), 'utf8');

  return readAnimation(/<style>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? '');
}

describe('generated animated Loggy', () => {
  // The generated components are committed, so an edit to an SVG's drawing or keyframes that was
  // not followed by `npm run generate-loggy-animated` would ship the old motion.
  it('is up to date with the SVGs', async () => {
    const generated = await generateAll();

    expect(Object.keys(generated)).toHaveLength(svgs.length);

    for (const [path, contents] of Object.entries(generated)) {
      expect({ path, same: readFileSync(path, 'utf8') === contents }).toEqual({ path, same: true });
    }
  }, 60_000);

  it.each(svgs)('%s opens and closes on the still frame', (svg) => {
    const { layers } = animationOf(svg);
    const identity = [1, 0, 0, 1, 0, 0];

    for (const layer of Object.values(layers)) {
      for (const time of [0, layer.durationMs]) {
        const { matrix, opacity } = sampleLoggyLayer(layer, time);

        expect(matrix.map((value) => Math.round(value * 1e9) / 1e9 + 0)).toEqual(identity);
        expect(opacity).toBe(1);
      }
    }
  });

  it.each(svgs)('%s runs every layer on one loop', (svg) => {
    const { loopMs, layers } = animationOf(svg);

    expect(Object.keys(layers).length).toBeGreaterThan(0);

    for (const layer of Object.values(layers)) {
      expect(loopMs % layer.durationMs).toBe(0);
    }
  });
});
