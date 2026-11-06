import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');
const POSES = join(root, 'assets', 'avatars', 'loggy-poses');
const source = readFileSync(join(root, 'components', 'LoggyPose.tsx'), 'utf8');

/** A PNG stores its size in the IHDR chunk, right after the 16-byte header. */
function pngAspect(file: string): number {
  const bytes = readFileSync(file);
  return bytes.readUInt32BE(16) / bytes.readUInt32BE(20);
}

describe('LoggyPose', () => {
  const svgs = readdirSync(POSES).filter((name) => name.endsWith('.svg'));

  it.each(svgs)('%s has a generated PNG', (svg) => {
    expect(existsSync(join(POSES, svg.replace(/\.svg$/, '.png')))).toBe(true);
  });

  it.each(svgs)('%s is in the pose table at its real proportions', (svg) => {
    const png = svg.replace(/\.svg$/, '.png');
    const entry = new RegExp(`${png.replace('.', '\\.')}'\\),\\s*aspect: ([0-9.]+)`).exec(source);

    expect(entry).not.toBeNull();
    expect(Number(entry?.[1])).toBeCloseTo(pngAspect(join(POSES, png)), 2);
  });
});
