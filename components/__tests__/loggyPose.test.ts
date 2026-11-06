import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');
const POSES = join(root, 'assets', 'avatars', 'loggy-poses');
const source = readFileSync(join(root, 'components', 'LoggyPose.tsx'), 'utf8');

/** The aspect the component draws at: width over height of the SVG's own `viewBox`. */
function viewBoxAspect(file: string): number {
  const match = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(
    readFileSync(file, 'utf8')
  );

  if (!match) {
    throw new Error(`${file} has no viewBox`);
  }

  return Number(match[1]) / Number(match[2]);
}

describe('LoggyPose', () => {
  const svgs = readdirSync(POSES).filter((name) => name.endsWith('.svg'));

  it('finds the poses', () => {
    expect(svgs.length).toBeGreaterThan(0);
  });

  it.each(svgs)('%s is imported by the pose table', (svg) => {
    expect(source).toContain(`'@/assets/avatars/loggy-poses/${svg}'`);
  });

  it.each(svgs)('%s is in the pose table at its real proportions', (svg) => {
    const pose = svg.replace(/^loggy-/, '').replace(/\.svg$/, '');
    const entry = new RegExp(`\\b${pose}: \\{\\s*Art: \\w+,\\s*aspect: ([0-9.]+)`).exec(source);

    expect(entry).not.toBeNull();
    expect(Number(entry?.[1])).toBeCloseTo(viewBoxAspect(join(POSES, svg)), 2);
  });

  it('ships no rasterised copies beside the SVGs', () => {
    expect(readdirSync(POSES).filter((name) => name.endsWith('.png'))).toEqual([]);
  });
});
