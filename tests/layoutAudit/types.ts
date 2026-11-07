/**
 * The shapes the layout audit passes between the in-page collector (browser), the analyzers and
 * the report (Node). Everything here is plain JSON so a snapshot can cross `page.evaluate`.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export type NodeKind = 'text' | 'interactive' | 'input' | 'image';

/** One thing a person can see or touch. Plain wrappers are never recorded. */
export interface LayoutNode {
  id: number;
  /** Nearest recorded ancestor; the overlap check ignores ancestor/descendant pairs. */
  parent: number | null;
  kind: NodeKind;
  /** What the node says (own text, aria-label, placeholder), cut to a readable length. */
  label: string;
  /** A short ancestry hint for finding the element in DevTools. */
  path: string;
  /**
   * Nodes share a context when they scroll together (same scroller, or none). Pairs inside one
   * context are compared by their full content rects; pairs across contexts only by what is on
   * screen right now, since a fixed bar and a scrolled row only meet at one scroll position.
   */
  scrollContext: string;
  /** Content rects (one per text line), clipped by `overflow: hidden` but not by scrolling. */
  rects: Rect[];
  /** What is on screen now: `rects` clipped by every scroller and the viewport. */
  visible: Rect[];
  /** Share of the ink cut by an `overflow: hidden` ancestor (0 none, 1 everything). */
  lossRatio: number;
  /** The element hides content wider/taller than its own box (overflow hidden, no ellipsis). */
  spillsX: boolean;
  spillsY: boolean;
  /** Text shortened on purpose (ellipsis or line clamp) and actually cut. */
  truncated: boolean;
  /** Words the layout split across lines with no hyphen or break point of their own. */
  brokenWords: string[];
  /** Label/path of whatever sits on top of this node's hit points, null when nothing does. */
  coveredBy: string | null;
  /** Whatever covers it is fixed or sticky (a bar, a sheet), not content that scrolls. */
  coveredByFixed: boolean;
  /** Fraction of the sampled hit points that something else receives. */
  coveredShare: number;
  /** False when the node is off screen and no scroller could bring it into view. */
  reachable: boolean;
}

export interface LayoutSnapshot {
  viewport: Viewport;
  /** `documentElement.scrollWidth`; wider than the viewport means the page scrolls sideways. */
  documentWidth: number;
  nodes: LayoutNode[];
  /** The collector stopped at its node cap, so later content was not examined. */
  capped: boolean;
}

export type FindingKind =
  | 'overlap'
  | 'occluded'
  | 'clipped'
  | 'truncated'
  | 'word-break'
  | 'overflow-x'
  | 'unreachable'
  | 'small-target'
  | 'tight-gap';

export type Severity = 'error' | 'warn' | 'info';

export interface Finding {
  /**
   * Every node involved is fixed or sticky: app chrome such as the bottom bar, which every screen
   * shares, so one defect there is one finding, not one per screen.
   */
  chrome?: boolean;
  kind: FindingKind;
  severity: Severity;
  message: string;
  /** The labels involved, used for the fingerprint and the report. */
  labels: string[];
  paths: string[];
  /** Where to outline it on a screenshot (viewport coordinates). */
  rects: Rect[];
}
