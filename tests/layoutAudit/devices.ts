import fs from 'fs';
import path from 'path';

/**
 * Device viewports for the layout audit, derived from `docs/SCREEN_SIZES.md`.
 *
 * That document lists physical pixels, but a layout is decided by CSS pixels (dp): the same
 * 1080 × 2400 panel is 360 dp wide on a Galaxy S21 5G and 411 dp on a Pixel 6. The densities
 * below are therefore ASSUMPTIONS, one or more per resolution, taken from the factory display
 * settings of the devices the document names. Where devices differ, every plausible density is
 * kept so the narrowest one is always tested. They are not measurements: correct a row here when
 * a real device reports something else. A resolution added to the document without a row falls
 * back to `fallbackDensity`.
 */
export const ASSUMED_DENSITIES: Record<string, number[]> = {
  // Infinix Smart 8: the lower density is the narrower layout, so it is the one kept.
  '720x1612': [2],
  // Galaxy Tab A9.
  '800x1340': [1.5],
  // Galaxy Z Fold4 cover screen.
  '904x2316': [2.5, 2.625],
  // Galaxy S22 / S23 FE / A56 draw 360 dp; S24 and S26 draw 384 dp.
  '1080x2340': [3, 2.8125],
  // Galaxy S21 5G 360 dp; Redmi Note 13 / Motorola Edge 40 Neo 393 dp; Pixel 6 / 7a / 8 411 dp.
  '1080x2400': [3, 2.75, 2.625],
  // Pixel 9a / 10a.
  '1080x2424': [2.625],
  // Galaxy Z Fold7 cover screen.
  '1080x2520': [3],
  // Redmi Note 14 Pro 5G, POCO X7 Pro.
  '1220x2712': [3, 2.75],
  // Pixel 9 Pro / 10 Pro.
  '1280x2856': [3],
  // Galaxy Note20 Ultra at its QHD+ setting.
  '1440x3088': [4, 3.5],
  // Galaxy S25 Ultra.
  '1440x3120': [3.75, 3.5],
  // OnePlus 13.
  '1440x3168': [3.5],
  // Galaxy Z Fold4 inner screen.
  '1812x2176': [2.625],
  // Galaxy Z Fold7 inner screen.
  '1968x2184': [2.8125],
};

/** Font scales to audit: the default, and the large-text accessibility setting. */
export const DEFAULT_FONT_SCALES = [1, 1.3];

/** A viewport at or below this CSS width is a phone layout; anything wider is audited as "large". */
export const PHONE_MAX_CSS_WIDTH = 450;

export interface Resolution {
  width: number;
  height: number;
  /** The devices the document lists for this resolution, when it has a table row for it. */
  devices: string[];
}

export interface DeviceViewport {
  id: string;
  pxWidth: number;
  pxHeight: number;
  density: number;
  cssWidth: number;
  cssHeight: number;
  devices: string[];
}

export interface AuditProfile {
  /** Stable name: `<cssWidth>x<cssHeight>-fs<scale>`, used as the Playwright project name. */
  id: string;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  fontScale: number;
  /** The device layout this profile stands for, before the font scale shrinks the viewport. */
  device: DeviceViewport;
  kind: 'phone' | 'large';
}

export type ProfileSet = 'quick' | 'phones' | 'all';

/** A density for a resolution the table does not know: aim for a ~400 dp wide layout. */
export function fallbackDensity(pxWidth: number): number {
  return Math.min(4.5, Math.max(1, Math.round((pxWidth / 400) * 8) / 8));
}

/**
 * Reads the "Unique Resolutions Only" block (lines like `1080x2400`), and the devices of the
 * "Devices by Resolution" table (rows like `| 1080 × 2400 | Pixel 6, Pixel 8 |`).
 */
export function parseResolutions(markdown: string): Resolution[] {
  const devicesByResolution = new Map<string, string[]>();
  for (const row of markdown.matchAll(/^\|\s*(\d+)\s*[×x]\s*(\d+)\s*\|\s*(.+?)\s*\|\s*$/gm)) {
    devicesByResolution.set(
      `${row[1]}x${row[2]}`,
      row[3]
        .split(',')
        .map((device) => device.trim())
        .filter(Boolean)
    );
  }

  const resolutions: Resolution[] = [];
  for (const line of markdown.matchAll(/^(\d+)x(\d+)\s*$/gm)) {
    const id = `${line[1]}x${line[2]}`;
    resolutions.push({
      width: Number(line[1]),
      height: Number(line[2]),
      devices: devicesByResolution.get(id) ?? [],
    });
  }

  return resolutions;
}

/** Every plausible CSS viewport of the resolutions, one per distinct CSS size. */
export function deviceViewports(resolutions: Resolution[]): DeviceViewport[] {
  const bySize = new Map<string, DeviceViewport>();
  for (const resolution of resolutions) {
    const key = `${resolution.width}x${resolution.height}`;
    const densities = ASSUMED_DENSITIES[key] ?? [fallbackDensity(resolution.width)];
    for (const density of densities) {
      const cssWidth = Math.round(resolution.width / density);
      const cssHeight = Math.round(resolution.height / density);
      const id = `${cssWidth}x${cssHeight}`;
      const existing = bySize.get(id);
      if (existing) {
        existing.devices = [...new Set([...existing.devices, ...resolution.devices])];
        continue;
      }

      bySize.set(id, {
        id,
        pxWidth: resolution.width,
        pxHeight: resolution.height,
        density,
        cssWidth,
        cssHeight,
        devices: resolution.devices,
      });
    }
  }

  return [...bySize.values()].sort((a, b) => a.cssWidth - b.cssWidth || a.cssHeight - b.cssHeight);
}

/**
 * Large text is emulated the way `playwright.progression.config.ts` does it: the viewport shrinks
 * by the font scale and the device scale factor grows by it, which is the layout a 1.3× font
 * produces. (A CSS `zoom` skews sheets, because react-native-web sizes them from window
 * dimensions that zoom does not change.) It is slightly pessimistic, since fixed-size icons do
 * not grow on a real device while the viewport still shrinks around them.
 */
export function buildProfiles(
  viewports: DeviceViewport[],
  fontScales: number[] = DEFAULT_FONT_SCALES
): AuditProfile[] {
  const profiles: AuditProfile[] = [];
  for (const device of viewports) {
    for (const fontScale of fontScales) {
      profiles.push({
        id: `${device.id}-fs${fontScale}`,
        viewport: {
          width: Math.floor(device.cssWidth / fontScale),
          height: Math.floor(device.cssHeight / fontScale),
        },
        deviceScaleFactor: fontScale,
        fontScale,
        device,
        kind: device.cssWidth <= PHONE_MAX_CSS_WIDTH ? 'phone' : 'large',
      });
    }
  }

  return profiles;
}

/**
 * - `quick` (default): the tightest phones. The narrowest and the shortest phone layouts at the
 *   large-text setting, plus the narrowest at normal text.
 * - `phones`: every phone layout at every font scale.
 * - `all`: also the tablet and foldable layouts.
 */
export function selectProfiles(profiles: AuditProfile[], set: ProfileSet): AuditProfile[] {
  if (set === 'all') {
    return profiles;
  }

  const phones = profiles.filter((profile) => profile.kind === 'phone');
  if (set === 'phones') {
    return phones;
  }

  const largest = Math.max(...phones.map((profile) => profile.fontScale));
  const normal = Math.min(...phones.map((profile) => profile.fontScale));
  const tightest = (profile: AuditProfile) => profile.device;
  const narrowest = [...phones].sort(
    (a, b) =>
      tightest(a).cssWidth - tightest(b).cssWidth || tightest(a).cssHeight - tightest(b).cssHeight
  )[0];
  const shortest = [...phones].sort(
    (a, b) =>
      tightest(a).cssHeight - tightest(b).cssHeight || tightest(a).cssWidth - tightest(b).cssWidth
  )[0];
  if (!narrowest || !shortest) {
    return [];
  }

  const wanted = new Set([
    `${narrowest.device.id}-fs${largest}`,
    `${shortest.device.id}-fs${largest}`,
    `${narrowest.device.id}-fs${normal}`,
  ]);

  return phones.filter((profile) => wanted.has(profile.id));
}

/** `MUSCLOG_LAYOUT_SET`, falling back to `quick` for an unknown value. */
export function resolveProfileSet(value: string | undefined): ProfileSet {
  return value === 'phones' || value === 'all' ? value : 'quick';
}

export function readScreenSizesDocument(
  documentPath = path.resolve(process.cwd(), 'docs', 'SCREEN_SIZES.md')
): string {
  return fs.readFileSync(documentPath, 'utf8');
}

/** The profiles an audit run covers: the document, expanded, then narrowed to the chosen set. */
export function loadAuditProfiles(
  set: ProfileSet = resolveProfileSet(process.env.MUSCLOG_LAYOUT_SET),
  documentPath?: string
): AuditProfile[] {
  const resolutions = parseResolutions(readScreenSizesDocument(documentPath));
  return selectProfiles(buildProfiles(deviceViewports(resolutions)), set);
}
