import type { Finding, LayoutNode, LayoutSnapshot, Rect, Severity } from './types';

/**
 * Pure analyzers over a `LayoutSnapshot`. They never touch a browser, so the same rules judge the
 * web build (DOM) and an Android dump (uiautomator).
 */

/** Overlaps thinner than this (px) are sub-pixel rounding or touching edges, not collisions. */
export const MIN_OVERLAP_PX = 3;
/**
 * Interactive neighbours closer than this (px), yet not flush, are "cramped". Flush neighbours
 * (a tab bar, a segmented control) are deliberate and fall under `FLUSH_GAP_PX`.
 */
export const TIGHT_GAP_PX = 4;
export const FLUSH_GAP_PX = 0.5;
/** Ink loss below this is anti-aliasing at an edge; above `HIDDEN_LOSS` it was hidden on purpose. */
export const MIN_LOSS_RATIO = 0.04;
export const HIDDEN_LOSS = 0.98;
/** A node covering more than this share of the screen is a backdrop or a page, not content. */
const BACKDROP_SHARE = 0.5;
/** Hit targets below these sides (px) are flagged; 44/48 is the platform guidance. */
export const SMALL_TARGET_PX = 32;
export const TINY_TARGET_PX = 24;
const MAX_FINDINGS_PER_KIND = 60;

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warn: 1, info: 2 };

export function area(rect: Rect): number {
  return Math.max(0, rect.w) * Math.max(0, rect.h);
}

export function intersection(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  if (right <= x || bottom <= y) {
    return null;
  }

  return { x, y, w: right - x, h: bottom - y };
}

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_ORDER[a] - SEVERITY_ORDER[b];
}

export function worstSeverity(severities: Severity[]): Severity {
  return [...severities].sort(compareSeverity)[0] ?? 'info';
}

interface OverlapMeasure {
  /** Intersection area over the smaller rect's area, 0–1. */
  ratio: number;
  /** The smaller rect lies entirely inside the other. */
  contained: boolean;
  region: Rect;
}

/** The strongest collision between any rect of `a` and any rect of `b`. */
export function measureOverlap(a: Rect[], b: Rect[]): OverlapMeasure | null {
  let best: OverlapMeasure | null = null;
  for (const first of a) {
    for (const second of b) {
      const region = intersection(first, second);
      if (!region || region.w < MIN_OVERLAP_PX || region.h < MIN_OVERLAP_PX) {
        continue;
      }

      const ratio = area(region) / Math.min(area(first), area(second));
      if (!best || ratio > best.ratio) {
        best = { ratio, contained: ratio >= 0.98, region };
      }
    }
  }

  return best;
}

function isRelated(a: LayoutNode, b: LayoutNode, byId: Map<number, LayoutNode>): boolean {
  const climbs = (from: LayoutNode, target: LayoutNode) => {
    let current: LayoutNode | undefined = from;
    while (current && current.parent !== null) {
      if (current.parent === target.id) {
        return true;
      }

      current = byId.get(current.parent);
    }

    return false;
  };

  return climbs(a, b) || climbs(b, a);
}

function isTouchable(node: LayoutNode): boolean {
  return node.kind === 'interactive' || node.kind === 'input';
}

/**
 * A node that stands for a whole layer (a modal backdrop, a page-sized pressable) overlaps
 * everything on top of it by construction, so it takes no part in pair checks.
 */
function isBackdrop(node: LayoutNode, viewport: LayoutSnapshot['viewport']): boolean {
  if (node.kind !== 'interactive' && node.kind !== 'image') {
    return false;
  }

  const screen = viewport.width * viewport.height;
  return node.rects.some((rect) => area(rect) > screen * BACKDROP_SHARE);
}

function comparableRects(a: LayoutNode, b: LayoutNode): [Rect[], Rect[]] {
  return a.scrollContext === b.scrollContext ? [a.rects, b.rects] : [a.visible, b.visible];
}

/** App chrome: fixed or sticky, so it does not move with the page it sits over. */
function isChrome(node: LayoutNode): boolean {
  return node.scrollContext.startsWith('fixed:');
}

/** One or two characters: an icon glyph, a unit or a bullet rather than a word. */
function isGlyph(node: LayoutNode): boolean {
  return node.kind === 'text' && node.label.length <= 2;
}

function overlapSeverity(a: LayoutNode, b: LayoutNode, overlap: OverlapMeasure): Severity {
  if (a.kind === 'image' || b.kind === 'image') {
    return overlap.ratio >= 0.5 ? 'warn' : 'info';
  }

  // An icon glyph or a unit laid over a control or a field is a layered design (the search icon
  // inside its field, a chevron in a row) far more often than a collision.
  if ((isGlyph(a) && isTouchable(b)) || (isGlyph(b) && isTouchable(a))) {
    return 'info';
  }

  if (isTouchable(a) && isTouchable(b)) {
    return overlap.contained ? 'warn' : 'error';
  }

  if (isTouchable(a) || isTouchable(b)) {
    // Text laid completely inside a control it does not belong to is a layered design more often
    // than a bug; text that only partly overlaps one is a collision.
    if (overlap.contained) {
      return 'info';
    }

    return overlap.ratio >= 0.2 ? 'error' : 'warn';
  }

  return overlap.ratio >= 0.15 ? 'error' : 'warn';
}

function describe(node: LayoutNode): string {
  const label = node.label ? `"${node.label}"` : `<${node.path.split(' > ').pop() ?? node.kind}>`;
  return `${node.kind} ${label}`;
}

function overlapFindings(snapshot: LayoutSnapshot, pass: AnalyzePass): Finding[] {
  const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const candidates = snapshot.nodes.filter(
    (node) =>
      !isBackdrop(node, snapshot.viewport) && (node.rects.length > 0 || node.visible.length > 0)
  );
  const findings: Finding[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      if (isRelated(a, b, byId)) {
        continue;
      }

      // Content scrolling under a bar (fixed, or laid over the scroller) is how scrolling works,
      // and a scroller clips its own content, so two things in different scroll contexts can only
      // meet where a bar covers the scroller. Only once it is scrolled to its end must the last of
      // it clear the bar, so the first screenful skips these pairs.
      if (pass === 'top' && a.scrollContext !== b.scrollContext && !(isChrome(a) && isChrome(b))) {
        continue;
      }

      const [first, second] = comparableRects(a, b);
      const overlap = measureOverlap(first, second);
      if (!overlap) {
        continue;
      }

      findings.push({
        kind: 'overlap',
        severity: overlapSeverity(a, b, overlap),
        message: `${describe(a)} overlaps ${describe(b)} (${Math.round(overlap.ratio * 100)}% of the smaller)`,
        labels: [a.label, b.label],
        paths: [a.path, b.path],
        rects: [overlap.region],
        chrome: isChrome(a) && isChrome(b),
      });
    }
  }

  return findings;
}

function occlusionFindings(snapshot: LayoutSnapshot, pass: AnalyzePass): Finding[] {
  return snapshot.nodes
    .filter(
      (node) =>
        isTouchable(node) &&
        node.coveredBy !== null &&
        node.coveredShare >= 0.4 &&
        // A backdrop is covered by the sheet it surrounds, by construction.
        !isBackdrop(node, snapshot.viewport) &&
        // Same as for overlaps: content under a fixed bar before it is scrolled to its end.
        !(pass === 'top' && node.coveredByFixed && !isChrome(node))
    )
    .map((node) => ({
      kind: 'occluded' as const,
      severity: node.coveredShare >= 0.6 ? ('error' as const) : ('warn' as const),
      message: `${describe(node)} is ${Math.round(node.coveredShare * 100)}% covered by ${node.coveredBy}`,
      labels: [node.label],
      paths: [node.path],
      rects: node.visible,
      chrome: isChrome(node),
    }));
}

function clippingFindings(snapshot: LayoutSnapshot): Finding[] {
  const findings: Finding[] = [];
  for (const node of snapshot.nodes) {
    if (node.lossRatio >= MIN_LOSS_RATIO && node.lossRatio < HIDDEN_LOSS) {
      findings.push({
        kind: 'clipped',
        severity: node.lossRatio >= 0.2 ? 'error' : 'warn',
        message: `${describe(node)} is ${Math.round(node.lossRatio * 100)}% cut off by a clipping parent`,
        labels: [node.label],
        paths: [node.path],
        rects: node.visible.length > 0 ? node.visible : node.rects,
        chrome: isChrome(node),
      });
      continue;
    }

    if ((node.spillsX || node.spillsY) && !node.truncated) {
      findings.push({
        kind: 'clipped',
        severity: 'warn',
        message: `${describe(node)} holds content ${node.spillsX ? 'wider' : 'taller'} than its box and hides the rest`,
        labels: [node.label],
        paths: [node.path],
        rects: node.visible.length > 0 ? node.visible : node.rects,
        chrome: isChrome(node),
      });
    }
  }

  return findings;
}

function truncationFindings(snapshot: LayoutSnapshot): Finding[] {
  const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  return snapshot.nodes
    .filter((node) => node.truncated)
    .map((node) => {
      const parent = node.parent === null ? undefined : byId.get(node.parent);
      // A cut label on a control, or a short label, loses its meaning; a long name in a list does not.
      const matters = (parent && isTouchable(parent)) || node.label.length <= 12;
      return {
        kind: 'truncated' as const,
        severity: matters ? ('warn' as const) : ('info' as const),
        message: `${describe(node)} is shortened with an ellipsis or line limit`,
        labels: [node.label],
        paths: [node.path],
        rects: node.visible.length > 0 ? node.visible : node.rects,
        chrome: isChrome(node),
      };
    });
}

function wordBreakFindings(snapshot: LayoutSnapshot): Finding[] {
  const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  return snapshot.nodes
    .filter((node) => node.brokenWords.length > 0)
    .map((node) => {
      const parent = node.parent === null ? undefined : byId.get(node.parent);
      // A control's label split mid-word is plainly broken; body text that does it is merely tight.
      const onControl = parent !== undefined && isTouchable(parent);
      return {
        kind: 'word-break' as const,
        severity: onControl ? ('error' as const) : ('warn' as const),
        message: `${describe(node)} breaks ${node.brokenWords.map((word) => `"${word}"`).join(', ')} across lines`,
        labels: [node.label],
        paths: [node.path],
        rects: node.visible.length > 0 ? node.visible : node.rects,
        chrome: isChrome(node),
      };
    });
}

function pageFindings(snapshot: LayoutSnapshot): Finding[] {
  const findings: Finding[] = [];
  if (snapshot.documentWidth > snapshot.viewport.width + 1) {
    findings.push({
      kind: 'overflow-x',
      severity: 'error',
      message: `the page is ${snapshot.documentWidth}px wide in a ${snapshot.viewport.width}px viewport (scrolls sideways)`,
      labels: ['page'],
      paths: ['document'],
      rects: [],
    });
  }

  for (const node of snapshot.nodes) {
    if (!node.reachable && node.rects.length > 0) {
      findings.push({
        kind: 'unreachable',
        severity: 'error',
        message: `${describe(node)} is off screen and nothing scrolls it into view`,
        labels: [node.label],
        paths: [node.path],
        rects: node.rects,
        chrome: isChrome(node),
      });
    }
  }

  return findings;
}

function targetFindings(snapshot: LayoutSnapshot): Finding[] {
  const touchable = snapshot.nodes.filter(
    (node) => isTouchable(node) && node.visible.length > 0 && !isBackdrop(node, snapshot.viewport)
  );
  const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const findings: Finding[] = [];
  for (const node of touchable) {
    const rect = node.visible[0];
    const shortSide = Math.min(rect.w, rect.h);
    if (shortSide < SMALL_TARGET_PX) {
      findings.push({
        kind: 'small-target',
        severity: shortSide < TINY_TARGET_PX ? 'warn' : 'info',
        message: `${describe(node)} is ${Math.round(rect.w)}×${Math.round(rect.h)}px, below the touch size`,
        labels: [node.label],
        paths: [node.path],
        rects: [rect],
        chrome: isChrome(node),
      });
    }
  }

  for (let i = 0; i < touchable.length; i++) {
    for (let j = i + 1; j < touchable.length; j++) {
      const a = touchable[i];
      const b = touchable[j];
      if (a.scrollContext !== b.scrollContext || isRelated(a, b, byId)) {
        continue;
      }

      const gap = gapBetween(a.visible[0], b.visible[0]);
      if (gap !== null && gap >= FLUSH_GAP_PX && gap < TIGHT_GAP_PX) {
        findings.push({
          kind: 'tight-gap',
          severity: 'warn',
          message: `${describe(a)} and ${describe(b)} are ${Math.max(0, Math.round(gap))}px apart`,
          labels: [a.label, b.label],
          paths: [a.path, b.path],
          rects: [a.visible[0], b.visible[0]],
          chrome: isChrome(a) && isChrome(b),
        });
      }
    }
  }

  return findings;
}

/**
 * Distance between two non-overlapping rects that sit side by side and face each other for at
 * least 40% of the shorter height; null when they are stacked, diagonal, far apart or overlap.
 * Stacked rows a hairline apart are a list, not a cramped row, so they are not measured.
 */
function gapBetween(a: Rect, b: Rect): number | null {
  if (intersection(a, b)) {
    return null;
  }

  const facing = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) >= 0.4 * Math.min(a.h, b.h);
  return facing ? Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)) : null;
}

function capPerKind(findings: Finding[]): Finding[] {
  const counts = new Map<string, number>();
  return [...findings]
    .sort((a, b) => compareSeverity(a.severity, b.severity))
    .filter((finding) => {
      const count = (counts.get(finding.kind) ?? 0) + 1;
      counts.set(finding.kind, count);
      return count <= MAX_FINDINGS_PER_KIND;
    });
}

/**
 * `top` is the first screenful, `end` the page scrolled to its end. Content that scrolls under a
 * fixed bar is only a problem at the end, where the last of it must clear the bar.
 */
export type AnalyzePass = 'top' | 'end';

export interface AnalyzeOptions {
  /** Defaults to `end`, the strict reading. */
  pass?: AnalyzePass;
}

/** Every finding for one snapshot, most severe first. */
export function analyzeSnapshot(snapshot: LayoutSnapshot, options: AnalyzeOptions = {}): Finding[] {
  const pass = options.pass ?? 'end';
  return capPerKind([
    ...overlapFindings(snapshot, pass),
    ...occlusionFindings(snapshot, pass),
    ...clippingFindings(snapshot),
    ...truncationFindings(snapshot),
    ...wordBreakFindings(snapshot),
    ...pageFindings(snapshot),
    ...targetFindings(snapshot),
  ]);
}
