import { analyzeSnapshot, measureOverlap, worstSeverity } from '../analyze';
import type { LayoutNode, LayoutSnapshot, Rect } from '../types';

let nextId = 0;

function box(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

function node(partial: Partial<LayoutNode> & { rects?: Rect[] }): LayoutNode {
  const rects = partial.rects ?? [box(0, 0, 50, 20)];
  return {
    id: nextId++,
    parent: null,
    kind: 'text',
    label: 'label',
    path: 'div',
    scrollContext: 'root',
    rects,
    visible: rects,
    lossRatio: 0,
    spillsX: false,
    spillsY: false,
    truncated: false,
    brokenWords: [],
    coveredBy: null,
    coveredByFixed: false,
    coveredShare: 0,
    reachable: true,
    ...partial,
  };
}

function snapshot(nodes: LayoutNode[], overrides: Partial<LayoutSnapshot> = {}): LayoutSnapshot {
  return {
    viewport: { width: 360, height: 780 },
    documentWidth: 360,
    nodes,
    capped: false,
    ...overrides,
  };
}

const kinds = (findings: ReturnType<typeof analyzeSnapshot>) => findings.map((f) => f.kind);

beforeEach(() => {
  nextId = 0;
});

describe('overlap', () => {
  it('flags two texts that collide as an error', () => {
    const findings = analyzeSnapshot(
      snapshot([
        node({ label: '/180g', rects: [box(100, 10, 40, 14)] }),
        node({ label: '99', rects: [box(120, 10, 40, 14)] }),
      ])
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: 'overlap', severity: 'error' });
    expect(findings[0].labels).toEqual(['/180g', '99']);
  });

  it('ignores touching edges and sub-pixel overlaps', () => {
    const touching = analyzeSnapshot(
      snapshot([node({ rects: [box(0, 0, 50, 20)] }), node({ rects: [box(50, 0, 50, 20)] })])
    );
    const stacked = analyzeSnapshot(
      snapshot([node({ rects: [box(0, 0, 50, 20)] }), node({ rects: [box(0, 20, 50, 20)] })])
    );
    // One pixel of overlap is rounding, not a collision.
    const subPixel = analyzeSnapshot(
      snapshot([node({ rects: [box(0, 0, 50, 20)] }), node({ rects: [box(49, 0, 50, 20)] })])
    );
    expect(kinds(touching)).not.toContain('overlap');
    expect(kinds(stacked)).not.toContain('overlap');
    expect(kinds(subPixel)).not.toContain('overlap');
  });

  it('skips a text and the control that contains it', () => {
    const button = node({ kind: 'interactive', label: 'Save', rects: [box(0, 0, 100, 40)] });
    const text = node({ parent: button.id, label: 'Save', rects: [box(20, 10, 60, 20)] });
    expect(kinds(analyzeSnapshot(snapshot([button, text])))).toEqual([]);
  });

  it('skips a text and a control that is its ancestor through a recorded wrapper', () => {
    const button = node({ kind: 'interactive', label: 'Row', rects: [box(0, 0, 200, 60)] });
    const wrapper = node({ parent: button.id, label: 'Title', rects: [box(10, 10, 100, 20)] });
    const inner = node({ parent: wrapper.id, label: 'sub', rects: [box(10, 10, 50, 20)] });
    expect(kinds(analyzeSnapshot(snapshot([button, wrapper, inner])))).toEqual([]);
  });

  it('calls text partly over a control an error, and text fully inside it only a note', () => {
    const control = node({ kind: 'interactive', label: 'Go', rects: [box(0, 0, 100, 40)] });
    const partial = node({ label: 'Collides', rects: [box(80, 10, 60, 20)] });
    const inside = node({ label: 'Layered', rects: [box(10, 10, 40, 20)] });

    const partlyOver = analyzeSnapshot(snapshot([control, partial]));
    expect(partlyOver[0]).toMatchObject({ kind: 'overlap', severity: 'error' });

    const fullyInside = analyzeSnapshot(snapshot([control, inside]));
    expect(fullyInside[0]).toMatchObject({ kind: 'overlap', severity: 'info' });
  });

  it('calls a small control laid inside a field its adornment (a note), not a collision', () => {
    const field = node({ kind: 'input', label: 'API key', rects: [box(0, 0, 300, 44)] });
    const eye = node({ kind: 'interactive', label: 'Show value', rects: [box(262, 6, 32, 32)] });
    expect(analyzeSnapshot(snapshot([field, eye]))[0]).toMatchObject({
      kind: 'overlap',
      severity: 'info',
    });

    // A button nearly as big as the field is a second control on top of it, not an adornment, so
    // it keeps the ordinary reading of two controls on each other (a warning once contained).
    const cover = node({ kind: 'interactive', label: 'Cover', rects: [box(40, 0, 260, 44)] });
    expect(analyzeSnapshot(snapshot([field, cover]))[0]).toMatchObject({ severity: 'warn' });
  });

  it('skips a nameless control with nothing inside it: a transparent hit layer has no ink', () => {
    const layer = node({ kind: 'interactive', label: '', rects: [box(0, 0, 300, 120)] });
    const axisLabel = node({ label: '172 lbs', rects: [box(-10, 40, 40, 14)] });
    expect(kinds(analyzeSnapshot(snapshot([layer, axisLabel])))).not.toContain('overlap');

    // A named control, or one that holds content, is still a control that can be collided with.
    const named = node({ kind: 'interactive', label: 'Chart', rects: [box(0, 0, 300, 120)] });
    expect(kinds(analyzeSnapshot(snapshot([named, axisLabel])))).toContain('overlap');
    const holder = node({ kind: 'interactive', label: '', rects: [box(0, 0, 300, 120)] });
    const inner = node({
      kind: 'image',
      label: 'icon',
      parent: holder.id,
      rects: [box(250, 5, 20, 20)],
    });
    const other = node({ label: 'Total', rects: [box(-10, 40, 40, 14)] });
    expect(kinds(analyzeSnapshot(snapshot([holder, inner, other])))).toContain('overlap');
  });

  it('calls two controls that overlap an error', () => {
    const findings = analyzeSnapshot(
      snapshot([
        node({ kind: 'interactive', label: 'A', rects: [box(0, 0, 100, 40)] }),
        node({ kind: 'interactive', label: 'B', rects: [box(60, 0, 100, 40)] }),
      ])
    );
    expect(findings.find((f) => f.kind === 'overlap')?.severity).toBe('error');
  });

  it('never treats a page-sized pressable (a backdrop) as colliding with its sheet', () => {
    const backdrop = node({ kind: 'interactive', label: '', rects: [box(0, 0, 360, 780)] });
    const sheetText = node({ label: 'Title', rects: [box(20, 400, 100, 20)] });
    expect(kinds(analyzeSnapshot(snapshot([backdrop, sheetText])))).not.toContain('overlap');
  });

  it('downgrades overlaps with images', () => {
    const findings = analyzeSnapshot(
      snapshot([
        node({ kind: 'image', label: '', rects: [box(0, 0, 40, 40)] }),
        node({ label: 'Caption', rects: [box(10, 10, 40, 14)] }),
      ])
    );
    expect(findings.find((f) => f.kind === 'overlap')?.severity).not.toBe('error');
  });

  it('compares full content rects inside one scroll context, but only what is visible across contexts', () => {
    const belowFold = node({
      label: 'Row',
      scrollContext: 'scroll:1',
      rects: [box(0, 900, 100, 20)],
      visible: [],
    });
    const sameContext = node({
      label: 'Other',
      scrollContext: 'scroll:1',
      rects: [box(50, 905, 100, 20)],
      visible: [],
    });
    const fixedBar = node({
      label: 'Bar',
      scrollContext: 'fixed:2',
      rects: [box(0, 900, 360, 60)],
      visible: [],
    });

    expect(kinds(analyzeSnapshot(snapshot([belowFold, sameContext])))).toContain('overlap');
    expect(kinds(analyzeSnapshot(snapshot([belowFold, fixedBar])))).not.toContain('overlap');
  });

  it('measures the strongest collision between multi-line text', () => {
    const lines = [box(0, 0, 100, 14), box(0, 14, 100, 14)];
    const other = [box(90, 14, 40, 14)];
    const overlap = measureOverlap(lines, other);
    expect(overlap?.ratio).toBeCloseTo((10 * 14) / (40 * 14));
    expect(overlap?.contained).toBe(false);
  });
});

describe('occlusion', () => {
  it('flags a control mostly covered by something else', () => {
    const findings = analyzeSnapshot(
      snapshot([
        node({
          kind: 'interactive',
          label: 'Save',
          rects: [box(0, 700, 200, 44)],
          coveredBy: '"Tab bar" div',
          coveredShare: 0.8,
        }),
      ])
    );
    expect(findings[0]).toMatchObject({ kind: 'occluded', severity: 'error' });
    expect(findings[0].message).toContain('Tab bar');
  });

  it('ignores a control that is barely covered', () => {
    const findings = analyzeSnapshot(
      snapshot([node({ kind: 'interactive', coveredBy: 'x', coveredShare: 0.2 })])
    );
    expect(kinds(findings)).not.toContain('occluded');
  });
});

describe('clipping', () => {
  it('flags content partly cut by a clipping parent, worse the more is lost', () => {
    const small = analyzeSnapshot(snapshot([node({ lossRatio: 0.1 })]));
    const large = analyzeSnapshot(snapshot([node({ lossRatio: 0.5 })]));
    expect(small[0]).toMatchObject({ kind: 'clipped', severity: 'warn' });
    expect(large[0]).toMatchObject({ kind: 'clipped', severity: 'error' });
  });

  it('ignores content that is fully hidden (a collapsed section) and anti-aliasing', () => {
    expect(kinds(analyzeSnapshot(snapshot([node({ lossRatio: 1 })])))).toEqual([]);
    expect(kinds(analyzeSnapshot(snapshot([node({ lossRatio: 0.01 })])))).toEqual([]);
  });

  it('flags an element that hides content wider than its box', () => {
    const findings = analyzeSnapshot(snapshot([node({ kind: 'interactive', spillsX: true })]));
    expect(findings[0]).toMatchObject({ kind: 'clipped', severity: 'warn' });
    expect(findings[0].message).toContain('wider');
  });

  it('does not double-report truncated text as clipped', () => {
    const findings = analyzeSnapshot(snapshot([node({ truncated: true, spillsX: true })]));
    expect(kinds(findings)).toEqual(['truncated']);
  });
});

describe('truncation', () => {
  it('is a note for a long name and a warning for a short label or a control label', () => {
    const long = analyzeSnapshot(
      snapshot([node({ truncated: true, label: 'A very long food name here' })])
    );
    const short = analyzeSnapshot(snapshot([node({ truncated: true, label: 'Workouts' })]));
    const button = node({ kind: 'interactive', label: 'x', rects: [box(0, 100, 300, 40)] });
    const onControl = node({
      parent: button.id,
      truncated: true,
      label: 'A control label that is long',
      rects: [box(10, 110, 100, 20)],
    });
    expect(long[0].severity).toBe('info');
    expect(short[0].severity).toBe('warn');
    expect(
      analyzeSnapshot(snapshot([button, onControl])).find((f) => f.kind === 'truncated')?.severity
    ).toBe('warn');
  });
});

describe('word-break', () => {
  it('is an error for a control label split mid-word and a warning for body text', () => {
    const button = node({ kind: 'interactive', label: 'Scan', rects: [box(0, 0, 150, 80)] });
    const label = node({
      parent: button.id,
      label: 'Сканировать штрих-код',
      brokenWords: ['Сканировать'],
      rects: [box(10, 10, 100, 60)],
    });
    const body = node({
      label: 'Paragraph',
      brokenWords: ['unbelievable'],
      rects: [box(0, 200, 100, 40)],
    });

    const onControl = analyzeSnapshot(snapshot([button, label]));
    expect(onControl.find((f) => f.kind === 'word-break')).toMatchObject({ severity: 'error' });
    expect(analyzeSnapshot(snapshot([body])).find((f) => f.kind === 'word-break')).toMatchObject({
      severity: 'warn',
    });
  });
});

describe('page and reachability', () => {
  it('flags a page that scrolls sideways', () => {
    const findings = analyzeSnapshot(snapshot([], { documentWidth: 420 }));
    expect(findings[0]).toMatchObject({ kind: 'overflow-x', severity: 'error' });
  });

  it('flags content that is off screen with nothing to scroll it into view', () => {
    const findings = analyzeSnapshot(
      snapshot([node({ reachable: false, rects: [box(400, 0, 50, 20)] })])
    );
    expect(findings[0]).toMatchObject({ kind: 'unreachable', severity: 'error' });
  });

  it('ignores an element parked thousands of pixels off screen on purpose', () => {
    const parked = node({
      kind: 'image',
      label: '',
      rects: [box(-9999, -9999, 300, 300)],
      reachable: false,
    });
    const cutOff = node({ label: 'Save', rects: [box(0, 1600, 100, 20)], reachable: false });
    const findings = analyzeSnapshot(snapshot([parked, cutOff]));
    expect(findings.filter((f) => f.kind === 'unreachable').map((f) => f.labels[0])).toEqual([
      'Save',
    ]);
  });
});

describe('touch targets', () => {
  it('notes a small control and warns on a tiny one', () => {
    const small = analyzeSnapshot(
      snapshot([node({ kind: 'interactive', rects: [box(0, 0, 43, 28)] })])
    );
    const tiny = analyzeSnapshot(
      snapshot([node({ kind: 'interactive', rects: [box(0, 0, 20, 20)] })])
    );
    expect(small[0]).toMatchObject({ kind: 'small-target', severity: 'info' });
    expect(tiny[0]).toMatchObject({ kind: 'small-target', severity: 'warn' });
  });

  it('warns about neighbours a few pixels apart, but not flush ones (a tab bar)', () => {
    const near = analyzeSnapshot(
      snapshot([
        node({ kind: 'interactive', label: 'A', rects: [box(0, 100, 60, 44)] }),
        node({ kind: 'interactive', label: 'B', rects: [box(62, 100, 60, 44)] }),
      ])
    );
    const flush = analyzeSnapshot(
      snapshot([
        node({ kind: 'interactive', label: 'A', rects: [box(0, 100, 60, 44)] }),
        node({ kind: 'interactive', label: 'B', rects: [box(60, 100, 60, 44)] }),
      ])
    );
    const spaced = analyzeSnapshot(
      snapshot([
        node({ kind: 'interactive', label: 'A', rects: [box(0, 100, 60, 44)] }),
        node({ kind: 'interactive', label: 'B', rects: [box(70, 100, 60, 44)] }),
      ])
    );
    expect(kinds(near)).toContain('tight-gap');
    expect(kinds(flush)).not.toContain('tight-gap');
    expect(kinds(spaced)).not.toContain('tight-gap');
  });
});

describe('ordering', () => {
  it('lists the most severe findings first and reports the worst severity', () => {
    const findings = analyzeSnapshot(
      snapshot([
        node({ kind: 'interactive', rects: [box(0, 0, 20, 20)], label: 'tiny' }),
        node({ lossRatio: 0.6, label: 'cut', rects: [box(0, 200, 50, 20)] }),
        node({
          truncated: true,
          label: 'A long name that is shortened',
          rects: [box(0, 300, 50, 20)],
        }),
      ])
    );
    expect(findings.map((f) => f.severity)).toEqual(['error', 'warn', 'info']);
    expect(worstSeverity(['info', 'warn'])).toBe('warn');
    expect(worstSeverity([])).toBe('info');
  });
});

describe('scrolling under fixed chrome', () => {
  const bar = () =>
    node({
      kind: 'interactive',
      label: 'Home',
      scrollContext: 'fixed:1',
      rects: [box(0, 700, 120, 80)],
    });
  const rowUnderBar = () =>
    node({ label: '107 kcal', scrollContext: 'root', rects: [box(100, 720, 60, 14)] });

  it('does not flag a scrolled row under a fixed bar in the first screenful', () => {
    expect(kinds(analyzeSnapshot(snapshot([bar(), rowUnderBar()]), { pass: 'top' }))).toEqual([]);
  });

  it('does flag it once the page is scrolled to its end, where the last row must clear the bar', () => {
    const findings = analyzeSnapshot(snapshot([bar(), rowUnderBar()]), { pass: 'end' });
    expect(findings[0]).toMatchObject({ kind: 'overlap', severity: 'error' });
    expect(findings[0].chrome).toBe(false);
  });

  it('reads the strict way when no pass is given', () => {
    expect(kinds(analyzeSnapshot(snapshot([bar(), rowUnderBar()])))).toEqual(['overlap']);
  });

  it('still flags two pieces of chrome that collide, in any pass', () => {
    const camera = node({
      kind: 'interactive',
      label: 'Open camera',
      scrollContext: 'fixed:2',
      rects: [box(100, 700, 60, 80)],
    });
    const findings = analyzeSnapshot(snapshot([bar(), camera]), { pass: 'top' });
    expect(findings[0]).toMatchObject({ kind: 'overlap', chrome: true });
  });

  it('skips a control under a fixed bar in the first screenful but not at the end', () => {
    const control = node({
      kind: 'interactive',
      label: 'Add food',
      rects: [box(0, 700, 200, 44)],
      coveredBy: '"Home" button',
      coveredByFixed: true,
      coveredShare: 0.8,
    });
    expect(kinds(analyzeSnapshot(snapshot([control]), { pass: 'top' }))).toEqual([]);
    expect(kinds(analyzeSnapshot(snapshot([control]), { pass: 'end' }))).toEqual(['occluded']);
  });

  it('still reports a control covered by something that scrolls, in the first screenful', () => {
    const control = node({
      kind: 'interactive',
      rects: [box(0, 100, 200, 44)],
      coveredBy: '"Banner" div',
      coveredByFixed: false,
      coveredShare: 0.8,
    });
    expect(kinds(analyzeSnapshot(snapshot([control]), { pass: 'top' }))).toEqual(['occluded']);
  });
});

describe('backdrops', () => {
  it('does not call a page-sized scrim covered by the sheet it surrounds an occluded control', () => {
    const scrim = node({
      kind: 'interactive',
      label: '',
      rects: [box(0, 0, 360, 780)],
      coveredBy: '"Track by meal type" div',
      coveredShare: 1,
    });
    expect(kinds(analyzeSnapshot(snapshot([scrim])))).toEqual([]);
  });
});

describe('icon glyphs', () => {
  it('treats a one or two character text over a control or a field as layering, not a collision', () => {
    const field = node({ kind: 'input', label: 'Search foods', rects: [box(33, 105, 278, 16)] });
    const icon = node({ label: 'E', rects: [box(291, 105, 20, 16)] });
    const findings = analyzeSnapshot(snapshot([field, icon]));
    expect(findings.find((f) => f.kind === 'overlap')?.severity).toBe('info');
  });

  it('still calls a real word over a control a collision', () => {
    const control = node({ kind: 'interactive', label: 'Go', rects: [box(0, 0, 100, 40)] });
    const word = node({ label: 'Collides', rects: [box(80, 10, 60, 20)] });
    expect(analyzeSnapshot(snapshot([control, word]))[0]).toMatchObject({
      kind: 'overlap',
      severity: 'error',
    });
  });
});

describe('chrome findings', () => {
  it('flags clipped and small controls in fixed chrome, so the report files them once', () => {
    const tab = node({
      kind: 'interactive',
      label: 'Workouts',
      scrollContext: 'fixed:1',
      rects: [box(0, 700, 20, 20)],
      lossRatio: 0.3,
    });
    const findings = analyzeSnapshot(snapshot([tab]));
    expect(findings.length).toBeGreaterThan(1);
    expect(findings.every((finding) => finding.chrome === true)).toBe(true);
  });

  it('does not mark content in the page as chrome', () => {
    const findings = analyzeSnapshot(snapshot([node({ lossRatio: 0.6 })]));
    expect(findings[0].chrome).toBe(false);
  });
});

describe('stacked rows', () => {
  it('does not call list rows a hairline apart a cramped row', () => {
    const findings = analyzeSnapshot(
      snapshot([
        node({ kind: 'interactive', label: 'Search', rects: [box(25, 484, 294, 64)] }),
        node({ kind: 'interactive', label: 'Scan', rects: [box(25, 549, 294, 64)] }),
      ])
    );
    expect(kinds(findings)).not.toContain('tight-gap');
  });
});

describe('a bar laid over a scroller rather than fixed', () => {
  const bar = () =>
    node({
      kind: 'interactive',
      label: 'Home',
      scrollContext: 'root',
      rects: [box(0, 700, 120, 80)],
    });
  const row = () =>
    node({ label: '107 kcal', scrollContext: 'scroll:1', rects: [box(100, 720, 60, 14)] });

  it('is not an overlap in the first screenful, where content simply scrolls under it', () => {
    expect(kinds(analyzeSnapshot(snapshot([bar(), row()]), { pass: 'top' }))).toEqual([]);
  });

  it('is one at the end of the scroll, where the last row has to clear the bar', () => {
    expect(kinds(analyzeSnapshot(snapshot([bar(), row()]), { pass: 'end' }))).toEqual(['overlap']);
  });

  it('still compares everything inside one scroll context in the first screenful', () => {
    const a = node({ label: '/180g', scrollContext: 'scroll:1', rects: [box(100, 10, 40, 14)] });
    const b = node({ label: '99', scrollContext: 'scroll:1', rects: [box(120, 10, 40, 14)] });
    expect(kinds(analyzeSnapshot(snapshot([a, b]), { pass: 'top' }))).toEqual(['overlap']);
  });
});

describe('escaped', () => {
  const escaped = (partial: Partial<LayoutNode>) =>
    analyzeSnapshot(snapshot([node(partial)])).filter((finding) => finding.kind === 'escaped');

  it('calls a control hanging off its card an error, naming the surface', () => {
    const [finding] = escaped({
      kind: 'interactive',
      label: 'Complete set',
      rects: [box(200, 20, 52, 40)],
      escapes: { by: 22, surface: 'div[data-testid=set-row]' },
    });
    expect(finding.severity).toBe('error');
    expect(finding.message).toContain('22px outside');
    expect(finding.message).toContain('set-row');
  });

  it('keeps text that spills a little to a warning and a small badge to a note', () => {
    expect(
      escaped({ kind: 'text', rects: [box(0, 0, 80, 20)], escapes: { by: 6, surface: 'div' } })[0]
        .severity
    ).toBe('warn');
    expect(
      escaped({
        kind: 'interactive',
        rects: [box(0, 0, 18, 18)],
        escapes: { by: 6, surface: 'div' },
      })[0].severity
    ).toBe('info');
  });

  it('ignores hairline overhangs and nodes the snapshot could not judge', () => {
    expect(escaped({ kind: 'interactive', escapes: { by: 1.5, surface: 'div' } })).toEqual([]);
    expect(escaped({ kind: 'interactive', escapes: null })).toEqual([]);
    expect(escaped({ kind: 'interactive' })).toEqual([]);
  });
});
