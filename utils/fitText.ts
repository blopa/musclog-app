import { fitFontSize } from '@/utils/yearInReview/storyLayout';

/**
 * Sizing a label to the box it was given. `adjustsFontSizeToFit` would do it natively, but
 * react-native-web ignores it, so a long word ("Entrenamiento", "Masculino") overflowed its tile on
 * the web build and in the layout audit; this works out the size once, from a measured width, and
 * every platform gets the same answer.
 */

/** The widest word of a label. Lines wrap between words, so this is what has to fit on one line. */
export function longestWord(text: string): string {
  return text
    .split(/\s+/)
    .reduce((widest, word) => (word.length > widest.length ? word : widest), '');
}

type FitLabelOptions = {
  /** The size the design asks for; used whenever the label already fits. */
  maxSize: number;
  /** The smallest size worth drawing; below it the label overflows rather than shrink further. */
  minSize: number;
  /** The OS text scale. Native text is drawn at `size * fontScale`, so the room is divided by it. */
  fontScale?: number;
};

/** The size at which `word` fits one line of `width`, before any minimum is applied. */
function fittingSize(
  word: string,
  width: number,
  maxSize: number,
  fontScale = 1,
  glyphWidthRatio?: number
): number {
  return fitFontSize(word, width / Math.max(1, fontScale), maxSize, glyphWidthRatio);
}

/**
 * The font size at which the label's longest word fits `availableWidth` on a line, between
 * `minSize` and `maxSize`. Before the width is known (`null`, the first frame) it is `maxSize`.
 */
export function fitLabelFontSize(
  text: string,
  availableWidth: number | null,
  { maxSize, minSize, fontScale }: FitLabelOptions
): number {
  if (availableWidth === null || availableWidth <= 0) {
    return maxSize;
  }

  const fitted = fittingSize(longestWord(text), availableWidth, maxSize, fontScale);

  return Math.max(minSize, Math.min(maxSize, fitted));
}

/**
 * Like `fitLabelFontSize`, for text that must stay on ONE line whole (a number and its unit, which
 * do not wrap between words): the room has to hold all of `text`, not just its longest word.
 */
export function fitLineFontSize(
  text: string,
  availableWidth: number | null,
  { maxSize, minSize, fontScale }: FitLabelOptions
): number {
  if (availableWidth === null || availableWidth <= 0) {
    return maxSize;
  }

  return Math.max(
    minSize,
    Math.min(maxSize, fittingSize(text, availableWidth, maxSize, fontScale))
  );
}

type EvenSplitOptions = {
  /** The size the labels are drawn at. */
  fontSize: number;
  /** What each option spends beside its label: horizontal padding, and an icon with its gap. */
  chrome: number;
  /** The space between neighbouring options. */
  gap: number;
  fontScale?: number;
  /** How many options share the row; the option count by default (a grid asks about 2). */
  columns?: number;
  /** The width of an average glyph as a share of the size; words in a text face run narrower than the default. */
  glyphWidthRatio?: number;
};

/**
 * Whether every label's longest word fits at `fontSize` when `rowWidth` is shared evenly between
 * the options. A segmented control splits its track evenly while that holds and lets the options
 * wrap onto another row once it does not, instead of breaking a word ("Estructura/do"). Before the
 * width is known (`null`) it says yes, which is what the first frame draws.
 */
export function labelsFitEvenly(
  labels: string[],
  rowWidth: number | null,
  { fontSize, chrome, gap, fontScale, columns, glyphWidthRatio }: EvenSplitOptions
): boolean {
  if (rowWidth === null || rowWidth <= 0 || labels.length === 0) {
    return true;
  }

  const shared = columns ?? labels.length;
  const each = (rowWidth - gap * (shared - 1)) / shared - chrome;

  return labels.every(
    (label) =>
      fittingSize(longestWord(label), each, fontSize, fontScale, glyphWidthRatio) >= fontSize
  );
}

type ActionLabelOptions = FitLabelOptions & {
  iconWidth: number;
  /** The space between the icon and the label. */
  gap: number;
  /** Beside the icon the label must stay at least this large, or the icon gives way. */
  comfortableSize: number;
};

type ActionLabelLayout = {
  /** The icon beside the label; dropped when keeping it would shrink the label below legibility. */
  showIcon: boolean;
  fontSize: number;
};

/**
 * Lays out a home tile (icon, gap, label) inside `contentWidth`. The icon stays while the label can
 * still be drawn at `comfortableSize` or more beside it; otherwise the icon gives its room to the
 * label, which then shrinks only as far as `minSize`.
 */
export function layoutActionLabel(
  label: string,
  contentWidth: number | null,
  { iconWidth, gap, comfortableSize, maxSize, minSize, fontScale }: ActionLabelOptions
): ActionLabelLayout {
  if (contentWidth === null) {
    return { showIcon: true, fontSize: maxSize };
  }

  const word = longestWord(label);
  const beside = fittingSize(word, contentWidth - iconWidth - gap, maxSize, fontScale);
  if (beside >= comfortableSize) {
    return { showIcon: true, fontSize: beside };
  }

  const alone = fittingSize(word, contentWidth, maxSize, fontScale);

  return { showIcon: false, fontSize: Math.max(minSize, Math.min(maxSize, alone)) };
}
