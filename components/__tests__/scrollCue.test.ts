import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

// Jest has no screen-rendering harness here, so these follow the other source checks.
describe('the "more below" scroll cue', () => {
  it('fades into the surface it sits on, never a fixed dark scrim', () => {
    const hook = read('hooks/useScrollFade.tsx');

    expect(hook).toMatch(/useSurfaceColor\(\)/);
    expect(hook).toMatch(/colors=\{\['transparent', surface\]\}/);
    expect(hook).not.toMatch(/backdrop90/);
    expect(hook).toMatch(/return \{ scrollProps, FadeIndicator, scrollRef \}/);
  });

  it('shows on the What’s new tour, whose upgrade intro runs past one screen', () => {
    const modal = read('components/whatsNew/WhatsNewModal.tsx');

    expect(modal).toMatch(/useScrollFade\(\)/);
    expect(modal).toMatch(/<ScrollView\s+\{\.\.\.scrollProps\}/);
    expect(modal).toMatch(/\{FadeIndicator\}/);
  });
});
