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
