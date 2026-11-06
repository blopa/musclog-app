import { execFileSync } from 'child_process';

import type { AuditProfile } from './devices';
import type { LayoutNode, LayoutSnapshot, Rect } from './types';

/**
 * The Android half of the layout audit: reads `uiautomator dump` XML into the same
 * `LayoutSnapshot` the web collector produces, so `analyzeSnapshot` judges both. A dump has the
 * accessibility tree only, so it can find overlaps, off-screen content and small targets, but not
 * clipping inside a parent, truncation or covered hit points (those fields stay empty).
 */

export const APP_PACKAGE = 'com.werules.logger';
export const APP_SCHEME = 'com.werules.logger';

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#10;': ' ',
  '&#13;': ' ',
};

function decode(value: string): string {
  return value.replace(
    /&(?:amp|lt|gt|quot|apos|#10|#13);/g,
    (entity) => ENTITIES[entity] ?? entity
  );
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    attributes[match[1]] = decode(match[2]);
  }

  return attributes;
}

function parseBounds(value: string | undefined): Rect | null {
  const match = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/.exec(value ?? '');
  if (!match) {
    return null;
  }

  const [left, top, right, bottom] = match.slice(1).map(Number);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export interface ParsedDump {
  snapshot: LayoutSnapshot;
  /** `keys[i]` identifies `snapshot.nodes[i]` across dumps, for "what appeared since" diffs. */
  keys: string[];
}

interface OpenNode {
  recordedId: number | null;
  scrollContext: string;
  scrollable: boolean;
}

function shorten(text: string, max = 48): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
}

function toDp(rect: Rect, density: number): Rect {
  const round = (value: number) => Math.round((value / density) * 10) / 10;
  return { x: round(rect.x), y: round(rect.y), w: round(rect.w), h: round(rect.h) };
}

/**
 * @param xml        the output of `uiautomator dump`
 * @param density    the display density as a multiplier (dpi / 160), to report dp, not pixels
 * @param screenPx   the physical screen size in pixels
 */
export function parseUiAutomatorDump(
  xml: string,
  density: number,
  screenPx: { width: number; height: number }
): ParsedDump {
  const viewport = {
    width: Math.round(screenPx.width / density),
    height: Math.round(screenPx.height / density),
  };
  const nodes: LayoutNode[] = [];
  const keys: string[] = [];
  const stack: OpenNode[] = [];
  let scrollerCount = 0;

  for (const tag of xml.matchAll(/<(\/?)node\b([^>]*?)(\/?)>/g)) {
    if (tag[1] === '/') {
      stack.pop();
      continue;
    }

    const attributes = parseAttributes(tag[2]);
    const parent = stack[stack.length - 1];
    const scrollable = attributes.scrollable === 'true';
    const scrollContext = scrollable
      ? `scroll:${scrollerCount++}`
      : (parent?.scrollContext ?? 'root');
    const bounds = parseBounds(attributes.bounds);
    const className = attributes.class ?? '';
    const text = shorten(attributes.text ?? '');
    const description = shorten(attributes['content-desc'] ?? '');
    const clickable = attributes.clickable === 'true';
    const isInput = /EditText|AutoCompleteTextView/.test(className);
    const isImage = /ImageView|ImageButton/.test(className);
    const label = text || description;

    let kind: LayoutNode['kind'] | null = null;
    if (isInput) {
      kind = 'input';
    } else if (clickable) {
      kind = 'interactive';
    } else if (text) {
      kind = 'text';
    } else if (isImage && description) {
      kind = 'image';
    }

    let recordedId = parent?.recordedId ?? null;
    if (kind && bounds && bounds.w > 0 && bounds.h > 0) {
      const rect = toDp(bounds, density);
      const visible = intersectWithScreen(rect, viewport);
      const outside =
        rect.x < -1 ||
        rect.y < -1 ||
        rect.x + rect.w > viewport.width + 1 ||
        rect.y + rect.h > viewport.height + 1;
      const insideScroller = scrollContext !== 'root';
      recordedId = nodes.length;
      nodes.push({
        id: recordedId,
        parent: parent?.recordedId ?? null,
        kind,
        label,
        path: `${className.split('.').pop() ?? className}${attributes['resource-id'] ? `[${attributes['resource-id'].split('/').pop()}]` : ''}`,
        scrollContext,
        rects: [rect],
        visible: visible ? [visible] : [],
        lossRatio: 0,
        spillsX: false,
        spillsY: false,
        truncated: false,
        brokenWords: [],
        coveredBy: null,
        coveredShare: 0,
        reachable: !outside || insideScroller,
      });
      keys.push(
        [className, attributes['resource-id'], text, description, attributes.bounds].join('|')
      );
    }

    if (tag[3] !== '/') {
      stack.push({ recordedId, scrollContext, scrollable });
    }
  }

  return { snapshot: { viewport, documentWidth: viewport.width, nodes, capped: false }, keys };
}

function intersectWithScreen(rect: Rect, viewport: { width: number; height: number }): Rect | null {
  const x = Math.max(rect.x, 0);
  const y = Math.max(rect.y, 0);
  const right = Math.min(rect.x + rect.w, viewport.width);
  const bottom = Math.min(rect.y + rect.h, viewport.height);
  return right <= x || bottom <= y ? null : { x, y, w: right - x, h: bottom - y };
}

/** Keeps only the nodes whose key was not in `baseline` — what a tap added to the screen. */
export function newSince(parsed: ParsedDump, baseline: Set<string>): LayoutSnapshot {
  const keep = new Map<number, number>();
  const nodes: LayoutNode[] = [];
  parsed.snapshot.nodes.forEach((node, index) => {
    if (baseline.has(parsed.keys[index])) {
      return;
    }

    keep.set(node.id, nodes.length);
    nodes.push({ ...node, id: nodes.length });
  });
  for (const node of nodes) {
    node.parent = node.parent === null ? null : (keep.get(node.parent) ?? null);
  }

  return { ...parsed.snapshot, nodes };
}

export function parseWmSize(output: string): { width: number; height: number } | null {
  const lines = output.split('\n');
  const line =
    lines.find((entry) => entry.startsWith('Override size')) ??
    lines.find((entry) => entry.startsWith('Physical size'));
  const match = /(\d+)x(\d+)/.exec(line ?? '');
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

export function parseWmDensity(output: string): number | null {
  const lines = output.split('\n');
  const line =
    lines.find((entry) => entry.startsWith('Override density')) ??
    lines.find((entry) => entry.startsWith('Physical density'));
  const match = /(\d+)/.exec(line ?? '');
  return match ? Number(match[1]) : null;
}

/** The `adb shell` arguments that make a device draw the profile's layout. */
export function displayCommands(profile: AuditProfile): string[][] {
  const { pxWidth, pxHeight, density } = profile.device;
  return [
    ['wm', 'size', `${pxWidth}x${pxHeight}`],
    ['wm', 'density', String(Math.round(density * 160))],
    ['settings', 'put', 'system', 'font_scale', String(profile.fontScale)],
  ];
}

export function deepLink(routePath: string): string {
  return `${APP_SCHEME}:///app${routePath}`;
}

export interface Adb {
  shell: (...args: string[]) => string;
  exec: (...args: string[]) => string;
  serial: string | null;
}

export function listDevices(): string[] {
  try {
    return execFileSync('adb', ['devices'], { encoding: 'utf8' })
      .split('\n')
      .slice(1)
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts[1] === 'device')
      .map((parts) => parts[0]);
  } catch {
    return [];
  }
}

export function createAdb(serial: string | null = process.env.ANDROID_SERIAL ?? null): Adb {
  const base = serial ? ['-s', serial] : [];
  const run = (args: string[]) =>
    execFileSync('adb', [...base, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return {
    serial,
    shell: (...args) => run(['shell', ...args]),
    exec: (...args) => run(['exec-out', ...args]),
  };
}

/** A UI dump; `uiautomator` refuses while an animation runs, so it retries a few times. */
export function dumpUi(adb: Adb, attempts = 4): string {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      adb.shell('uiautomator', 'dump', '/sdcard/layout-audit.xml');
      return adb.exec('cat', '/sdcard/layout-audit.xml');
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
