import { computePopoverTop } from '@/components/website/popoverPlacement';

describe('computePopoverTop', () => {
  it('opens below the trigger when the space below fits the popover', () => {
    expect(
      computePopoverTop({
        triggerRect: { top: 100, bottom: 140 },
        popoverHeight: 400,
        viewportHeight: 900,
      })
    ).toBe(152);
  });

  it('flips above the trigger when the space below is too tight', () => {
    // A popover anchored low in the panel — 690px down an 844px viewport — used
    // to render off the bottom of the screen.
    expect(
      computePopoverTop({
        triggerRect: { top: 640, bottom: 690 },
        popoverHeight: 400,
        viewportHeight: 844,
      })
    ).toBe(228);
  });

  it('never places the popover above the top viewport margin', () => {
    expect(
      computePopoverTop({
        triggerRect: { top: 80, bottom: 130 },
        popoverHeight: 700,
        viewportHeight: 600,
      })
    ).toBe(16);
  });

  it('opens downward while the height is still unmeasured', () => {
    expect(
      computePopoverTop({
        triggerRect: { top: 640, bottom: 690 },
        popoverHeight: 0,
        viewportHeight: 844,
      })
    ).toBe(702);
  });

  it('has nothing to anchor to before the trigger is measured', () => {
    expect(computePopoverTop({ triggerRect: null, popoverHeight: 400, viewportHeight: 844 })).toBe(
      0
    );
  });
});
