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

  it('is an opt-in of FullScreenModal that sits above the footer, and the Premium paywall uses it', () => {
    const modal = read('components/modals/FullScreenModal.tsx').replace(/\s+/g, ' ');

    expect(modal).toContain('scrollCue = false');
    expect(modal).toContain('{...(scrollCue ? scrollHandlers : {})}');
    expect(modal).toMatch(
      /\{scrollCue \? \( <View pointerEvents="box-none"[^>]*bottom: scrollCueBottom\(footerHeight\)/
    );
    // The chevron scrolls the body's own ref, the caller's when it passed one.
    expect(modal).toContain('const bodyRef = scrollViewRef ?? ownScrollRef');
    expect(read('components/modals/PremiumModal.tsx')).toContain('scrollCue={isPaywall}');
  });

  it('ends above a floating footer where its gradient starts, not at its full height', () => {
    const {
      BOTTOM_BUTTON_TOP_FADE,
      scrollCueBottom,
    } = require('@/components/modals/footerClearance');

    expect(scrollCueBottom(0)).toBe(0);
    expect(scrollCueBottom(Number.NaN)).toBe(0);
    expect(scrollCueBottom(150)).toBe(150 - BOTTOM_BUTTON_TOP_FADE);
    expect(scrollCueBottom(10)).toBe(0);
    // The constant is the wrapper's own top padding (pt-6 = 24px).
    expect(BOTTOM_BUTTON_TOP_FADE).toBe(24);
    expect(read('components/BottomButtonWrapper.tsx')).toContain('className="px-6 pb-6 pt-6"');
    expect(read('components/modals/FullScreenModal.tsx')).toContain(
      'bottom: scrollCueBottom(footerHeight)'
    );
    expect(read('app/app/onboarding/musclog-api.tsx')).toContain(
      'bottom: scrollCueBottom(footerHeight)'
    );
  });
});
