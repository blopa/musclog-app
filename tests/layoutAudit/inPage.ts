import type { LayoutNode, LayoutSnapshot, Rect } from './types';

/**
 * Functions that run INSIDE the page via `page.evaluate`. Playwright serializes each one with
 * `toString()`, so every function here must be self-contained: no imports of values, no
 * references to module-level constants or to each other. (Types are erased and are fine.)
 */

export interface CollectOptions {
  /** Only record elements added since `markBaseline` — i.e. the modal that was just opened. */
  onlyNew: boolean;
}

/** Stamps every element present now, so a later snapshot can tell a freshly opened layer apart. */
export function markBaseline(): number {
  const all = document.querySelectorAll('*');
  for (let i = 0; i < all.length; i++) {
    all[i].setAttribute('data-la-base', '1');
  }

  return all.length;
}

/**
 * For a sheet that opens by itself with its page (a one-time welcome): stamps everything OUTSIDE
 * the top-level layer holding `selector`, so a snapshot of what is new is the sheet alone and the
 * page it covers is not reported as occluded by it. react-native-web portals a Modal to a direct
 * child of `<body>`; returns false, stamping nothing, when `selector` is missing or sits in the
 * page itself (`#root`), where the sheet cannot be told apart from what it covers.
 */
export function markBaselineOutsideLayer(selector: string): boolean {
  const target = document.querySelector(selector);
  if (!target) {
    return false;
  }

  const root = document.getElementById('root');
  if (root?.contains(target)) {
    return false;
  }

  let layer: Element = target;
  while (layer.parentElement && layer.parentElement !== document.body) {
    layer = layer.parentElement;
  }

  const all = document.querySelectorAll('*');
  for (let i = 0; i < all.length; i++) {
    if (!layer.contains(all[i])) {
      all[i].setAttribute('data-la-base', '1');
    }
  }

  return true;
}

/**
 * For an overlay that is already open when it is measured (a tour that opens with its page, the
 * next page of a multi-step sheet, a sheet opened over another sheet): isolates the topmost one.
 * react-native-web gives every mounted Modal a host `<div>` directly under `<body>`, empty while
 * closed, and a nested modal mounts after the one it opened from, so the last host whose content
 * has a box is what is on top. Everything outside it is stamped and every stamp inside it is cleared
 * (content an earlier baseline saw, such as a step's own header, is measured again). Returns false,
 * changing nothing, when no overlay is open.
 */
export function isolateTopLayer(): boolean {
  const root = document.getElementById('root');
  const layers = Array.from(document.body.children).filter((child) => {
    if (child.tagName !== 'DIV' || child.children.length === 0) {
      return false;
    }

    if (root && (child === root || child.contains(root))) {
      return false;
    }

    // The host itself is 0 px wide; its content is a `position: fixed` child with the real box.
    const box = (child.firstElementChild ?? child).getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  });
  const layer = layers[layers.length - 1];
  if (!layer) {
    return false;
  }

  const all = document.querySelectorAll('*');
  for (let i = 0; i < all.length; i++) {
    if (layer.contains(all[i])) {
      all[i].removeAttribute('data-la-base');
    } else {
      all[i].setAttribute('data-la-base', '1');
    }
  }

  return true;
}

/**
 * How many overlays are open, by the same rule as `isolateTopLayer` (repeated, not shared: a
 * function run through `page.evaluate` cannot call another). A flow closes an overlay and checks
 * the count went down before it moves on.
 */
export function countOpenLayers(): number {
  const root = document.getElementById('root');
  return Array.from(document.body.children).filter((child) => {
    if (child.tagName !== 'DIV' || child.children.length === 0) {
      return false;
    }

    if (root && (child === root || child.contains(root))) {
      return false;
    }

    // The host itself is 0 px wide; its content is a `position: fixed` child with the real box.
    const box = (child.firstElementChild ?? child).getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  }).length;
}

export function collectLayoutSnapshot(options: CollectOptions): LayoutSnapshot {
  const BASE_ATTR = 'data-la-base';
  const NODE_CAP = 4000;
  const FAR = 1e7;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const INTERACTIVE_SELECTOR =
    'button, a[href], summary, [role="button"], [role="link"], [role="tab"], [role="radio"], ' +
    '[role="switch"], [role="checkbox"], [role="menuitem"], [role="option"], [tabindex]:not([tabindex="-1"])';
  const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'HEAD', 'TEMPLATE', 'LINK', 'META']);
  const MEDIA_TAGS = new Set(['IMG', 'svg', 'SVG', 'CANVAS', 'VIDEO']);
  const nodes: LayoutNode[] = [];
  /** `elements[i]` is the DOM element behind `nodes[i]`, for the hit test. */
  const elements: Element[] = [];
  let capped = false;
  let nextContextId = 0;

  const round = (value: number): number => Math.round(value * 10) / 10;
  const toRect = (box: { left: number; top: number; width: number; height: number }): Rect => ({
    x: round(box.left),
    y: round(box.top),
    w: round(box.width),
    h: round(box.height),
  });
  /** The box minus border and padding: where a field's own text can appear. */
  const contentBox = (box: Rect, style: CSSStyleDeclaration): Rect => {
    const left = (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.paddingLeft) || 0);
    const right = (parseFloat(style.borderRightWidth) || 0) + (parseFloat(style.paddingRight) || 0);
    const top = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.paddingTop) || 0);
    const bottom =
      (parseFloat(style.borderBottomWidth) || 0) + (parseFloat(style.paddingBottom) || 0);
    const w = box.w - left - right;
    const h = box.h - top - bottom;
    return w > 0 && h > 0
      ? { x: round(box.x + left), y: round(box.y + top), w: round(w), h: round(h) }
      : box;
  };

  const areaOf = (rect: Rect): number => Math.max(0, rect.w) * Math.max(0, rect.h);
  const totalArea = (rects: Rect[]): number => {
    let sum = 0;
    for (let i = 0; i < rects.length; i++) {
      sum += areaOf(rects[i]);
    }

    return sum;
  };

  const intersect = (a: Rect, b: Rect): Rect | null => {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.w, b.x + b.w);
    const bottom = Math.min(a.y + a.h, b.y + b.h);
    return right <= x || bottom <= y ? null : { x, y, w: right - x, h: bottom - y };
  };

  const clipAll = (rects: Rect[], clips: Rect[]): Rect[] => {
    const result: Rect[] = [];
    for (let i = 0; i < rects.length; i++) {
      let current: Rect | null = rects[i];
      for (let j = 0; j < clips.length && current; j++) {
        current = intersect(current, clips[j]);
      }

      if (current) {
        result.push(current);
      }
    }

    return result;
  };

  const shorten = (text: string, max: number): string => {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
  };

  const pathOf = (element: Element): string => {
    const parts: string[] = [];
    let current: Element | null = element;
    for (let depth = 0; current && depth < 3 && current !== document.body; depth++) {
      const testId = current.getAttribute('data-testid');
      const role = current.getAttribute('role');
      let hint = '';
      if (testId) {
        hint = '[data-testid=' + testId + ']';
      } else if (role) {
        hint = '[role=' + role + ']';
      }

      parts.unshift(current.tagName.toLowerCase() + hint);
      current = current.parentElement;
    }

    return parts.join(' > ');
  };

  const ownText = (element: Element): Text[] => {
    const found: Text[] = [];
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== '') {
        found.push(child as Text);
      }
    }

    return found;
  };

  const lineRects = (texts: Text[]): Rect[] => {
    const rects: Rect[] = [];
    for (let i = 0; i < texts.length; i++) {
      const range = document.createRange();
      range.selectNodeContents(texts[i]);
      const list = range.getClientRects();
      for (let j = 0; j < list.length; j++) {
        if (list[j].width > 0.5 && list[j].height > 0.5) {
          rects.push(toRect(list[j]));
        }
      }
    }

    return rects;
  };

  /**
   * Words the layout cut across lines although they hold no hyphen or soft hyphen: "Сканиро/вать".
   * Only multi-line text can hold one, and words under four letters are never reported.
   */
  const splitWords = (texts: Text[], lineCount: number): string[] => {
    const found: string[] = [];
    if (lineCount < 2) {
      return found;
    }

    for (let i = 0; i < texts.length && found.length < 5; i++) {
      const data = texts[i].data;
      const words = /\S+/g;
      let match = words.exec(data);
      while (match && found.length < 5) {
        const word = match[0];
        if (word.length >= 4 && !/[-\u2010\u2011\u2013\u2014\u00ad/]/.test(word)) {
          const range = document.createRange();
          range.setStart(texts[i], match.index);
          range.setEnd(texts[i], match.index + word.length);
          const rects = range.getClientRects();
          let lines = 0;
          let lastTop = -1e9;
          for (let j = 0; j < rects.length; j++) {
            if (Math.abs(rects[j].top - lastTop) > 2) {
              lines++;
              lastTop = rects[j].top;
            }
          }

          if (lines > 1) {
            found.push(word);
          }
        }

        match = words.exec(data);
      }
    }

    return found;
  };

  /** True when the element, or anything it sits in, is fixed or sticky: a bar or a sheet. */
  const inFixedBox = (element: Element): boolean => {
    let current: Element | null = element;
    while (current && current !== document.body) {
      const position = window.getComputedStyle(current).position;
      if (position === 'fixed' || position === 'sticky') {
        return true;
      }

      current = current.parentElement;
    }

    return false;
  };

  /** The nearest ancestor that really scrolls vertically (its content is taller than its box). */
  const scrollerOf = (element: Element): Element | null => {
    let current: Element | null = element.parentElement;
    while (current && current !== document.body) {
      const overflowY = window.getComputedStyle(current).overflowY;
      if (
        (overflowY === 'auto' || overflowY === 'scroll') &&
        current.scrollHeight > current.clientHeight + 1
      ) {
        return current;
      }

      current = current.parentElement;
    }

    return null;
  };

  const describeHit = (element: Element): string => {
    const label = element.getAttribute('aria-label') ?? shorten(element.textContent ?? '', 30);
    return (label ? '"' + label + '" ' : '') + pathOf(element);
  };

  /** What an element passes down to what it contains. */
  interface Context {
    parentId: number | null;
    /** Clips from `overflow: hidden|clip` only: this is content that is really cut off. */
    hard: Rect[];
    /** Clips from every scroller and hidden box, and the viewport: this is what is on screen. */
    soft: Rect[];
    scrollContext: string;
    scrollsY: boolean;
    scrollsX: boolean;
    /**
     * The nearest ancestor that paints a surface (a background or a border) and the box it paints.
     * Reset by a scroller (scrolled content may run past it) and by a fixed layer (a sheet).
     */
    surface: { rect: Rect; path: string } | null;
  }

  const documentScroller = document.scrollingElement;
  const rootContext: Context = {
    parentId: null,
    hard: [],
    soft: [{ x: 0, y: 0, w: viewportWidth, h: viewportHeight }],
    scrollContext: 'root',
    scrollsY:
      !!documentScroller && documentScroller.scrollHeight > documentScroller.clientHeight + 1,
    scrollsX: false,
    surface: null,
  };

  /** Alpha of a computed `rgb()`/`rgba()` colour; `transparent` is 0. */
  const alphaOf = (color: string): number => {
    if (!color || color === 'transparent') {
      return 0;
    }

    const match = /rgba?\(([^)]+)\)/.exec(color);
    if (!match) {
      return 1;
    }

    const parts = match[1].split(/[\s,/]+/).filter(Boolean);
    return parts.length >= 4 ? parseFloat(parts[3]) : 1;
  };

  /** The element draws a visible box: a background, or a border on any side. */
  const paintsSurface = (style: CSSStyleDeclaration): boolean => {
    if (alphaOf(style.backgroundColor) > 0.05) {
      return true;
    }

    const sides = ['Top', 'Right', 'Bottom', 'Left'] as const;
    for (let i = 0; i < sides.length; i++) {
      const side = sides[i];
      if (
        (parseFloat(style.getPropertyValue('border-' + side.toLowerCase() + '-width')) || 0) >= 1 &&
        style.getPropertyValue('border-' + side.toLowerCase() + '-style') !== 'none' &&
        alphaOf(style.getPropertyValue('border-' + side.toLowerCase() + '-color')) > 0.05
      ) {
        return true;
      }
    }

    return false;
  };

  /** How far `rects` reach outside `surface`, in px (0 when they stay inside). */
  const escapeOf = (
    rects: Rect[],
    surface: Context['surface']
  ): { by: number; surface: string } | null => {
    if (!surface || rects.length === 0) {
      return null;
    }

    let by = 0;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      by = Math.max(
        by,
        surface.rect.x - r.x,
        r.x + r.w - (surface.rect.x + surface.rect.w),
        surface.rect.y - r.y,
        r.y + r.h - (surface.rect.y + surface.rect.h)
      );
    }

    return by > 0.5 ? { by: round(by), surface: surface.path } : null;
  };

  const isPointerRoot = (element: Element, style: CSSStyleDeclaration): boolean => {
    if (style.cursor !== 'pointer') {
      return false;
    }

    const parent = element.parentElement;
    return !parent || window.getComputedStyle(parent).cursor !== 'pointer';
  };

  const record = (
    element: Element,
    context: Context,
    parentId: number | null,
    kind: LayoutNode['kind'],
    label: string,
    rects: Rect[],
    flags: {
      spillsX: boolean;
      spillsY: boolean;
      truncated: boolean;
      brokenWords?: string[];
      /** The surface the node must stay on (the one around the element, not its own). */
      surface: Context['surface'];
    }
  ): number => {
    const contentRects = clipAll(rects, context.hard);
    const visibleRects = clipAll(contentRects, context.soft);
    const rawArea = totalArea(rects);
    // Text shortened on purpose is reported as truncated, not as ink lost to a clipping parent.
    const lossRatio = rawArea > 0 && !flags.truncated ? 1 - totalArea(contentRects) / rawArea : 0;
    let reachable = true;
    if (contentRects.length > 0) {
      let left = contentRects[0].x;
      let top = contentRects[0].y;
      let right = left + contentRects[0].w;
      let bottom = top + contentRects[0].h;
      for (let i = 1; i < contentRects.length; i++) {
        left = Math.min(left, contentRects[i].x);
        top = Math.min(top, contentRects[i].y);
        right = Math.max(right, contentRects[i].x + contentRects[i].w);
        bottom = Math.max(bottom, contentRects[i].y + contentRects[i].h);
      }

      const outsideX = right > viewportWidth + 1 || left < -1;
      const outsideY = bottom > viewportHeight + 1 || top < -1;
      reachable = (!outsideX || context.scrollsX) && (!outsideY || context.scrollsY);
    }

    const id = nodes.length;
    nodes.push({
      id,
      parent: parentId,
      kind,
      label,
      path: pathOf(element),
      scrollContext: context.scrollContext,
      rects: contentRects,
      visible: visibleRects,
      lossRatio: Math.round(lossRatio * 100) / 100,
      spillsX: flags.spillsX,
      spillsY: flags.spillsY,
      truncated: flags.truncated,
      brokenWords: flags.brokenWords ?? [],
      coveredBy: null,
      coveredByFixed: false,
      coveredShare: 0,
      reachable,
      escapes: escapeOf(contentRects, flags.surface),
    });
    elements.push(element);
    return id;
  };

  const visit = (element: Element, context: Context): void => {
    if (nodes.length >= NODE_CAP) {
      capped = true;
      return;
    }

    if (SKIPPED_TAGS.has(element.tagName)) {
      return;
    }

    const style = window.getComputedStyle(element);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse' ||
      parseFloat(style.opacity) < 0.05
    ) {
      return;
    }

    const boxRect = toRect(element.getBoundingClientRect());
    const hasArea = boxRect.w > 0 && boxRect.h > 0;
    const isNew = !options.onlyNew || !element.hasAttribute(BASE_ATTR);
    const isInput =
      element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT';
    const isMedia = MEDIA_TAGS.has(element.tagName);
    const isInteractive =
      !isInput &&
      !isMedia &&
      (element.matches(INTERACTIVE_SELECTOR) || isPointerRoot(element, style));

    // A fixed or sticky element is not moved or clipped by the scroller it sits in.
    const fixed = style.position === 'fixed' || style.position === 'sticky';
    const own: Context = fixed
      ? {
          parentId: context.parentId,
          hard: [],
          soft: rootContext.soft,
          scrollContext: 'fixed:' + nextContextId++,
          scrollsX: false,
          scrollsY: false,
          surface: null,
        }
      : context;

    const overflowX = style.overflowX;
    const overflowY = style.overflowY;
    const hidesX = overflowX === 'hidden' || overflowX === 'clip';
    const hidesY = overflowY === 'hidden' || overflowY === 'clip';
    const scrollerX =
      (overflowX === 'auto' || overflowX === 'scroll') &&
      element.scrollWidth > element.clientWidth + 1;
    const scrollerY =
      (overflowY === 'auto' || overflowY === 'scroll') &&
      element.scrollHeight > element.clientHeight + 1;
    const inner: Context = { ...own };
    if (hasArea && (overflowX !== 'visible' || overflowY !== 'visible')) {
      inner.soft = own.soft.concat([boxRect]);
      if (scrollerX || scrollerY) {
        // Content inside a scroller can be scrolled into view, so a clip established outside it
        // (the box the scroller sits in) is the scroll edge, not content that is cut off.
        inner.hard = [];
      }

      if (hidesX || hidesY) {
        inner.hard = inner.hard.concat([
          {
            x: hidesX ? boxRect.x : -FAR,
            y: hidesY ? boxRect.y : -FAR,
            w: hidesX ? boxRect.w : 2 * FAR,
            h: hidesY ? boxRect.h : 2 * FAR,
          },
        ]);
      }

      if (scrollerX || scrollerY) {
        inner.surface = null;
        inner.scrollContext = 'scroll:' + nextContextId++;
        inner.scrollsX = own.scrollsX || scrollerX;
        inner.scrollsY = own.scrollsY || scrollerY;
      }
    }

    if (hasArea && !scrollerX && !scrollerY && paintsSurface(style)) {
      inner.surface = { rect: boxRect, path: pathOf(element) };
    }

    let boxNodeId: number | null = null;
    if (isNew && hasArea && (isInput || isInteractive || isMedia)) {
      const label = shorten(
        isInput
          ? (element.getAttribute('aria-label') ??
              element.getAttribute('placeholder') ??
              (element as HTMLInputElement).value ??
              '')
          : (element.getAttribute('aria-label') ??
              element.getAttribute('alt') ??
              element.getAttribute('title') ??
              element.textContent ??
              ''),
        48
      );
      let boxKind: LayoutNode['kind'] = 'interactive';
      if (isMedia) {
        boxKind = 'image';
      } else if (isInput) {
        boxKind = 'input';
      }

      // A field's typed text lives in its content box, so the padding it reserves for an icon or a
      // button laid over its edge counts: that control then sits beside the text, not on it.
      const boxRects = isInput ? [contentBox(boxRect, style)] : [boxRect];
      boxNodeId = record(element, own, own.parentId, boxKind, label, boxRects, {
        spillsX: !isMedia && hidesX && element.scrollWidth > element.clientWidth + 1,
        spillsY: !isMedia && hidesY && element.scrollHeight > element.clientHeight + 1,
        truncated: false,
        surface: own.surface,
      });
      inner.parentId = boxNodeId;
    }

    if (isMedia) {
      return;
    }

    const texts = isInput ? [] : ownText(element);
    if (isNew && texts.length > 0) {
      const rects = lineRects(texts);
      if (rects.length > 0) {
        const ellipsis = style.textOverflow === 'ellipsis';
        const clamp = style.getPropertyValue('-webkit-line-clamp');
        const clamped = clamp !== '' && clamp !== 'none' && clamp !== 'normal';
        const cutX = element.scrollWidth > element.clientWidth + 1;
        const cutY = element.scrollHeight > element.clientHeight + 1;
        const truncated = (ellipsis && cutX) || (clamped && cutY);
        const standalone = boxNodeId === null;
        inner.parentId = record(
          element,
          inner,
          boxNodeId ?? own.parentId,
          'text',
          shorten(texts.map((text) => text.textContent ?? '').join(' '), 48),
          rects,
          {
            // The box node of a control already reports its own spill; plain text reports it here.
            spillsX: standalone && !truncated && hidesX && cutX,
            spillsY: standalone && !truncated && hidesY && cutY,
            truncated,
            brokenWords: truncated ? [] : splitWords(texts, rects.length),
            surface: own.surface,
          }
        );
      }
    }

    for (let i = 0; i < element.children.length; i++) {
      visit(element.children[i], inner);
    }
  };

  if (document.body) {
    for (let i = 0; i < document.body.children.length; i++) {
      visit(document.body.children[i], rootContext);
    }
  }

  // Hit-test every control at five points: whatever receives the touch instead of the control is
  // sitting on top of it.
  const SAMPLE_POINTS: [number, number][] = [
    [0.5, 0.5],
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.kind !== 'interactive' && node.kind !== 'input') {
      continue;
    }

    let biggest: Rect | null = null;
    for (let j = 0; j < node.visible.length; j++) {
      if (!biggest || areaOf(node.visible[j]) > areaOf(biggest)) {
        biggest = node.visible[j];
      }
    }

    if (!biggest || areaOf(biggest) < 16) {
      continue;
    }

    const owner = elements[i];
    const ownerScroller = scrollerOf(owner);
    let covered = 0;
    let coveredBy: string | null = null;
    let coveredByFixed = false;
    for (let p = 0; p < SAMPLE_POINTS.length; p++) {
      const hit = document.elementFromPoint(
        biggest.x + biggest.w * SAMPLE_POINTS[p][0],
        biggest.y + biggest.h * SAMPLE_POINTS[p][1]
      );
      if (
        !hit ||
        hit === document.body ||
        hit === document.documentElement ||
        hit === owner ||
        owner.contains(hit) ||
        hit.contains(owner)
      ) {
        continue;
      }

      covered++;
      coveredBy = coveredBy ?? describeHit(hit);
      // A fixed or sticky bar, or any layer outside the scroller the control sits in (the app's
      // pinned bottom bar is `absolute`, not fixed): the content scrolls under it, and only what is
      // still under it once scrolled to the end is a real occlusion.
      coveredByFixed =
        coveredByFixed ||
        inFixedBox(hit) ||
        (ownerScroller !== null && !ownerScroller.contains(hit));
    }

    node.coveredShare = covered / SAMPLE_POINTS.length;
    node.coveredBy = covered > 0 ? coveredBy : null;
    node.coveredByFixed = covered > 0 && coveredByFixed;
  }

  return {
    viewport: { width: viewportWidth, height: viewportHeight },
    documentWidth: document.documentElement.scrollWidth,
    nodes,
    capped,
  };
}

/**
 * Scrolls the largest scroller (inside the freshly opened layer when `onlyNew`) to its end, so a
 * second snapshot shows the last rows against any pinned footer. Returns whether anything moved.
 */
export function scrollLargestToEnd(onlyNew: boolean): boolean {
  let best: Element | null = null;
  let bestArea = 0;
  const all = document.querySelectorAll('*');
  for (let i = 0; i < all.length; i++) {
    const element = all[i];
    if (onlyNew && element.hasAttribute('data-la-base')) {
      continue;
    }

    const style = window.getComputedStyle(element);
    const scrolls =
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      element.scrollHeight > element.clientHeight + 4;
    if (!scrolls) {
      continue;
    }

    const size = element.clientWidth * element.clientHeight;
    if (size > bestArea) {
      best = element;
      bestArea = size;
    }
  }

  if (!best) {
    return false;
  }

  const before = best.scrollTop;
  best.scrollTop = best.scrollHeight;
  return best.scrollTop !== before;
}

/**
 * Pseudo-localization: lengthens every readable string by roughly `factor` by doubling vowels,
 * which keeps word boundaries (so wrapping behaves like a real, longer translation). Numbers and
 * strings under three letters are left alone. Idempotent per text node.
 */
export function applyPseudoLocale(factor: number): number {
  const seenKey = '__laPseudoSeen';
  const holder = window as unknown as Record<string, WeakMap<Text, string> | undefined>;
  const seen = holder[seenKey] ?? new WeakMap<Text, string>();
  holder[seenKey] = seen;
  const VOWELS = /[aeiouyáàâäãåéèêëíìîïóòôöõúùûüаеёиоуыэюяАЕЁИОУЫЭЮЯ]/;
  // Any script with letter case; avoids Unicode property escapes so a transpiled copy still runs.
  const isLetter = (char: string): boolean => char.toLowerCase() !== char.toUpperCase();

  const expand = (text: string): string => {
    let letters = 0;
    for (const char of text) {
      if (isLetter(char)) {
        letters++;
      }
    }

    if (letters < 3) {
      return text;
    }

    let extra = Math.ceil(letters * (factor - 1));
    let result = '';
    for (const char of text) {
      result += char;
      if (extra > 0 && VOWELS.test(char)) {
        result += char;
        extra--;
      }
    }

    // A vowel-poor string is stretched at its end instead.
    while (extra > 0) {
      result += result.charAt(result.length - 1) || 'x';
      extra--;
    }

    return result;
  };

  let changed = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const textNode = current as Text;
    const parent = textNode.parentElement;
    const skip =
      !parent ||
      parent.tagName === 'SCRIPT' ||
      parent.tagName === 'STYLE' ||
      parent.tagName === 'NOSCRIPT' ||
      parent.tagName === 'TEXTAREA';
    if (!skip && seen.get(textNode) !== textNode.data) {
      const expanded = expand(textNode.data);
      if (expanded !== textNode.data) {
        textNode.data = expanded;
        changed++;
      }

      seen.set(textNode, textNode.data);
    }

    current = walker.nextNode();
  }

  return changed;
}
