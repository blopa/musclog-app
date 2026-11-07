import {
  ASSUMED_DENSITIES,
  buildProfiles,
  deviceViewports,
  fallbackDensity,
  loadAuditProfiles,
  parseResolutions,
  readScreenSizesDocument,
  resolveProfileSet,
  selectProfiles,
} from '../devices';

const SAMPLE = `
| Resolution | Devices |
|---|---|
| 1080 × 2400 | Pixel 6, Galaxy S21 5G |
| 904 × 2316 | Galaxy Z Fold4 (cover) |

\`\`\`text
1080x2400
904x2316
999x2000
\`\`\`
`;

describe('parseResolutions', () => {
  it('reads the unique-resolutions block and the devices table', () => {
    expect(parseResolutions(SAMPLE)).toEqual([
      { width: 1080, height: 2400, devices: ['Pixel 6', 'Galaxy S21 5G'] },
      { width: 904, height: 2316, devices: ['Galaxy Z Fold4 (cover)'] },
      { width: 999, height: 2000, devices: [] },
    ]);
  });

  it('reads the real document and finds all 14 resolutions', () => {
    const resolutions = parseResolutions(readScreenSizesDocument());
    expect(resolutions).toHaveLength(14);
    expect(resolutions.every((resolution) => resolution.width > 0 && resolution.height > 0)).toBe(
      true
    );
  });

  it('has an assumed density for every resolution in the document', () => {
    for (const { width, height } of parseResolutions(readScreenSizesDocument())) {
      expect(ASSUMED_DENSITIES[`${width}x${height}`]).toBeDefined();
    }
  });
});

describe('deviceViewports', () => {
  const viewports = deviceViewports(parseResolutions(SAMPLE));

  it('turns pixels into CSS pixels with each assumed density and sorts narrowest first', () => {
    expect(viewports.map((viewport) => viewport.id)).toEqual([
      '344x882', // 904x2316 at 2.625
      '360x800', // 1080x2400 at 3
      '362x926', // 904x2316 at 2.5
      '393x873', // 1080x2400 at 2.75
      '400x800', // 999x2000 at the fallback density 2.5
      '411x914', // 1080x2400 at 2.625
    ]);
  });

  it('keeps every plausible density so the narrowest layout is always tested', () => {
    const ids = viewports.map((viewport) => viewport.id);
    expect(ids).toContain('360x800');
    expect(ids).toContain('393x873');
    expect(ids).toContain('411x914');
    expect(ids).toContain('344x882');
  });

  it('falls back to a density for a resolution the table does not know', () => {
    const unknown = viewports.find((viewport) => viewport.pxWidth === 999);
    expect(unknown?.density).toBe(fallbackDensity(999));
    expect(unknown?.cssWidth).toBe(Math.round(999 / fallbackDensity(999)));
  });

  it('merges devices when two densities land on one CSS size', () => {
    const merged = deviceViewports([
      { width: 1080, height: 2400, devices: ['A'] },
      { width: 1080, height: 2400, devices: ['B'] },
    ]);
    const first = merged.find((viewport) => viewport.id === '360x800');
    expect(first?.devices.sort()).toEqual(['A', 'B']);
  });
});

describe('buildProfiles', () => {
  it('shrinks the viewport by the font scale and scales the device pixel ratio by it', () => {
    const [profile] = buildProfiles(
      [
        {
          id: '360x780',
          pxWidth: 1080,
          pxHeight: 2340,
          density: 3,
          cssWidth: 360,
          cssHeight: 780,
          devices: [],
        },
      ],
      [1.3]
    );
    expect(profile.id).toBe('360x780-fs1.3');
    expect(profile.viewport).toEqual({ width: 276, height: 600 });
    expect(profile.deviceScaleFactor).toBe(1.3);
    expect(profile.kind).toBe('phone');
  });

  it('calls anything wider than a phone "large"', () => {
    const [profile] = buildProfiles(
      [
        {
          id: '700x776',
          pxWidth: 1968,
          pxHeight: 2184,
          density: 2.8125,
          cssWidth: 700,
          cssHeight: 776,
          devices: [],
        },
      ],
      [1]
    );
    expect(profile.kind).toBe('large');
  });
});

describe('selectProfiles', () => {
  const all = buildProfiles(deviceViewports(parseResolutions(readScreenSizesDocument())));

  it('quick keeps the narrowest and shortest phones at large text, plus the narrowest at normal', () => {
    const quick = selectProfiles(all, 'quick');
    const narrowest = Math.min(
      ...all.filter((p) => p.kind === 'phone').map((p) => p.device.cssWidth)
    );
    const shortest = Math.min(
      ...all.filter((p) => p.kind === 'phone').map((p) => p.device.cssHeight)
    );
    expect(quick.length).toBeGreaterThanOrEqual(2);
    expect(quick.length).toBeLessThanOrEqual(3);
    expect(quick.some((p) => p.device.cssWidth === narrowest && p.fontScale === 1)).toBe(true);
    expect(quick.some((p) => p.device.cssWidth === narrowest && p.fontScale === 1.3)).toBe(true);
    expect(quick.some((p) => p.device.cssHeight === shortest && p.fontScale === 1.3)).toBe(true);
  });

  it('phones excludes tablet and foldable layouts; all keeps them', () => {
    expect(selectProfiles(all, 'phones').every((profile) => profile.kind === 'phone')).toBe(true);
    expect(selectProfiles(all, 'all')).toHaveLength(all.length);
    expect(all.some((profile) => profile.kind === 'large')).toBe(true);
  });

  it('loads the quick set from the real document by default', () => {
    expect(loadAuditProfiles('quick').map((profile) => profile.id)).toEqual(
      selectProfiles(all, 'quick').map((profile) => profile.id)
    );
  });
});

describe('resolveProfileSet', () => {
  it('accepts the known sets and falls back to quick', () => {
    expect(resolveProfileSet('phones')).toBe('phones');
    expect(resolveProfileSet('all')).toBe('all');
    expect(resolveProfileSet('bogus')).toBe('quick');
    expect(resolveProfileSet(undefined)).toBe('quick');
  });
});

describe('fallbackDensity', () => {
  it('aims for a layout about 400 dp wide, in eighths, and stays in range', () => {
    expect(fallbackDensity(1080)).toBe(2.75);
    expect(fallbackDensity(100)).toBe(1);
    expect(fallbackDensity(99999)).toBe(4.5);
  });
});
