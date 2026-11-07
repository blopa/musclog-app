import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');

/** Strip comments so a documented prop name can't satisfy an assertion. */
function code(path: string): string {
  return readFileSync(join(root, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe.each([
  ['components/BodyHighlighter.tsx', 'onBodyPartPress'],
  ['components/BodyHighlighter.web.tsx', 'onBodyPartClick'],
])('%s', (path, pressProp) => {
  const source = code(path);

  it('takes ready-made slug shading and makes muscleGroups optional', () => {
    expect(source).toMatch(/slugIntensities\?: ReadonlyMap<MuscleSlug, number>/);
    expect(source).toMatch(/muscleGroups\?: /);
    expect(source).toMatch(/slugIntensities \?\? buildSlugIntensityMap\(muscleGroups\)/);
  });

  it(`reports presses through ${pressProp}, once per body`, () => {
    expect(source).toMatch(new RegExp(`${pressProp}=\\{`));
    expect(source.match(new RegExp(`${pressProp}=\\{`, 'g'))).toHaveLength(2);
  });
});
