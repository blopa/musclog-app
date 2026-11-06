import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');
const POSES = join(root, 'assets', 'avatars', 'loggy-poses');
const ANIMATED = join(root, 'assets', 'avatars', 'loggy-animated');
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

describe('animated Loggy', () => {
  const animated = readdirSync(ANIMATED).filter((name) => name.endsWith('.svg'));

  it('finds the animations', () => {
    expect(animated.length).toBeGreaterThan(0);
  });

  it.each(animated)('%s animates a pose that exists, at its proportions', (svg) => {
    expect(viewBoxAspect(join(ANIMATED, svg))).toBeCloseTo(viewBoxAspect(join(POSES, svg)), 2);
  });

  // A copy drawn some other way (the wave was once raster layers) drifts from its still and
  // splits at the joints it moves.
  it.each(animated)('%s is drawn from its still, path for path', (svg) => {
    const file = readFileSync(join(ANIMATED, svg), 'utf8');
    const still = new Set(readFileSync(join(POSES, svg), 'utf8').match(/<path [^>]*\/>/g) ?? []);
    const paths = file.match(/<path [^>]*\/>/g) ?? [];

    expect(file).not.toMatch(/<image\b/);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.filter((path) => !still.has(path))).toEqual([]);
  });

  // The component is generated (`npm run generate-loggy-animated`); this checks it is registered.
  it.each(animated)('%s has its generated component in the animated pose table', (svg) => {
    const pose = svg.replace(/^loggy-/, '').replace(/\.svg$/, '');
    const component = `Loggy${pose.charAt(0).toUpperCase()}${pose.slice(1)}Animated`;

    expect(source).toContain(`'@/components/loggy/animated/${component}'`);
    expect(source).toMatch(new RegExp(`\\b${pose}: ${component},`));
  });

  it.each(animated)('%s stands still under reduced motion', (svg) => {
    expect(readFileSync(join(ANIMATED, svg), 'utf8')).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*animation:\s*none\s*!important/
    );
  });

  it.each(animated)('%s moves only layers it has', (svg) => {
    const file = readFileSync(join(ANIMATED, svg), 'utf8');
    const css = /<style>([\s\S]*?)<\/style>/.exec(file)?.[1].replace(/\/\*[\s\S]*?\*\//g, '') ?? '';
    const selectors = [...css.matchAll(/#([a-z][\w-]*)[^{};]*[,{]/g)].map((match) => match[1]);

    for (const id of selectors) {
      expect(file).toContain(`id="${id}"`);
    }
  });
});
