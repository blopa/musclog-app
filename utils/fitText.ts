/**
 * Sizing a label to the box it was given. `adjustsFontSizeToFit` would do it natively, but
 * react-native-web ignores it, so a long word ("Entrenamiento", "Masculino") overflowed its tile on
 * the web build and in the layout audit; this works out the size once, from a measured width, and
 * every platform gets the same answer.
 */

/**
 * A digit or letter of bold system type is about this wide, as a share of its font size. It is the
 * estimate for figures (a number and its unit, a poster's hero figure) and, for lack of a measured
 * one, for the labels that have always been fitted with it.
 */
export const NUMERAL_GLYPH_RATIO = 0.62;

/** Words in a semibold text face average about this share of the size, narrower than a numeral. */
export const WORD_GLYPH_RATIO = 0.56;

/**
 * The largest size at which `text` fits one line of `availableWidth`, capped at `maxSize`. Worked
 * out rather than left to `adjustsFontSizeToFit`, which react-native-web ignores, so a large
 * "1,204,332" fits on every platform.
 */
export function fitFontSize(
  text: string,
  availableWidth: number,
  maxSize: number,
  glyphWidthRatio: number = NUMERAL_GLYPH_RATIO
): number {
  const widest = text.length * glyphWidthRatio;
  return widest > 0 ? Math.min(maxSize, Math.floor(availableWidth / widest)) : maxSize;
}

/** The widest word of a label. Lines wrap between words, so this is what has to fit on one line. */
export function longestWord(text: string): string {
  return text
    .split(/\s+/)
    .reduce((widest, word) => (word.length > widest.length ? word : widest), '');
}

/** The widest word across several texts (a row's title and its description). */
function widestWord(texts: readonly string[]): string {
  return longestWord(texts.join(' '));
}

/** The room inside a measured box once `inset` is taken from each side; `null` until it is measured. */
export function insetWidth(width: number | null, inset: number): number | null {
  return width === null ? null : width - 2 * inset;
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

type Rung<Layout> = {
  /** The width the longest word has to fit in if this layout is chosen. */
  room: number;
  layout: Layout;
};

type RungOptions = {
  /** The largest size, which a layout is drawn at whenever it fits. */
  maxSize: number;
  /** The smallest size worth drawing; the last rung shrinks to it rather than go below. */
  minSize: number;
  /** A rung before the last is chosen when the word fits its room at this size or larger. */
  acceptAt: number;
  fontScale?: number;
  glyphWidthRatio?: number;
};

/**
 * Picks among layouts ordered from the one the design asks for to the one that gives the most room
 * to the text (the icon, then the switch, give way in turn). The first rung whose room holds `word`
 * at `acceptAt` or larger is used, at the size that fits it; the last rung is the fallback and
 * shrinks the type, down to `minSize`, instead of giving up another piece of the row.
 */
function pickRung<Layout>(
  word: string,
  rungs: readonly [Rung<Layout>, ...Rung<Layout>[]],
  { maxSize, minSize, acceptAt, fontScale, glyphWidthRatio }: RungOptions
): Layout & { fontSize: number } {
  const sizeIn = (room: number) => fittingSize(word, room, maxSize, fontScale, glyphWidthRatio);

  for (const { room, layout } of rungs.slice(0, -1)) {
    const size = sizeIn(room);

    if (size >= acceptAt) {
      return { ...layout, fontSize: size };
    }
  }

  const last = rungs[rungs.length - 1];

  return { ...last.layout, fontSize: Math.max(minSize, Math.min(maxSize, sizeIn(last.room))) };
}

/**
 * The font size at which the label's longest word fits `availableWidth` on a line, between
 * `minSize` and `maxSize`. Before the width is known (`null`, the first frame) it is `maxSize`.
 */
export function fitLabelFontSize(
  text: string,
  availableWidth: number | null,
  options: FitLabelOptions
): number {
  return fitLineFontSize(longestWord(text), availableWidth, options);
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

  return pickRung(
    longestWord(label),
    [
      { room: contentWidth - iconWidth - gap, layout: { showIcon: true } },
      { room: contentWidth, layout: { showIcon: false } },
    ],
    { maxSize, minSize, acceptAt: comfortableSize, fontScale }
  );
}

/** What a settings or navigation row asks of its layout, whatever sits at its trailing edge. */
type RowFitOptions = {
  /** The size the row's text is designed at. */
  fontSize: number;
  /** The smallest size worth drawing; below it the row overflows rather than shrink further. */
  minSize: number;
  /** What the leading icon takes from the text beside it: its width plus the gap. 0 without one. */
  iconRoom: number;
  /** The decoration gives way before anything else is tried (`isCrampedLayout`). */
  dropIcon: boolean;
  fontScale?: number;
  glyphWidthRatio?: number;
};

type ToggleRowOptions = RowFitOptions & {
  /** What the switch takes from the text beside it: its width plus the gap. */
  switchRoom: number;
};

type ToggleRowLayout = {
  showIcon: boolean;
  /** The switch sits under the text instead of beside it, which gives the text the whole row. */
  stackSwitch: boolean;
  fontSize: number;
};

/**
 * Lays out one settings toggle (icon, label with description, switch) inside `rowWidth`, never
 * breaking a word. The longest word of any of `texts` decides. In order: keep the row as designed;
 * move the switch under the text (the text then has the whole row); give the icon's room to the
 * text; and only when even that is too narrow, draw the type a little smaller down to `minSize`.
 * `dropIcon` (a cramped layout) removes the icon from the start. Before the row is measured
 * (`null`, the first frame) it is the designed row.
 */
export function layoutToggleRow(
  texts: string[],
  rowWidth: number | null,
  {
    fontSize,
    minSize,
    iconRoom,
    switchRoom,
    dropIcon,
    fontScale,
    glyphWidthRatio = WORD_GLYPH_RATIO,
  }: ToggleRowOptions
): ToggleRowLayout {
  const hasIcon = iconRoom > 0 && !dropIcon;

  if (rowWidth === null || rowWidth <= 0) {
    return { showIcon: hasIcon, stackSwitch: false, fontSize };
  }

  const roomWithIcon = hasIcon ? iconRoom : 0;

  return pickRung(
    widestWord(texts),
    [
      {
        room: rowWidth - roomWithIcon - switchRoom,
        layout: { showIcon: hasIcon, stackSwitch: false },
      },
      { room: rowWidth - roomWithIcon, layout: { showIcon: hasIcon, stackSwitch: true } },
      { room: rowWidth, layout: { showIcon: false, stackSwitch: true } },
    ],
    { maxSize: fontSize, minSize, acceptAt: fontSize, fontScale, glyphWidthRatio }
  );
}

type IconRowOptions = RowFitOptions & {
  /** What the trailing chevron takes from the text: its width plus the gap. */
  trailingRoom: number;
};

type IconRowLayout = {
  showIcon: boolean;
  fontSize: number;
};

/**
 * Lays out a navigation row (leading icon, text, trailing chevron) inside `rowWidth` without
 * breaking a word: the icon gives its room to the text when the longest word does not fit beside
 * it (always while `dropIcon`), and only then is the type drawn a little smaller, down to
 * `minSize`. The chevron is the row's affordance and stays. Before the row is measured (`null`) it
 * is the designed row.
 */
export function layoutIconRow(
  texts: string[],
  rowWidth: number | null,
  {
    fontSize,
    minSize,
    iconRoom,
    trailingRoom,
    dropIcon,
    fontScale,
    glyphWidthRatio = WORD_GLYPH_RATIO,
  }: IconRowOptions
): IconRowLayout {
  if (rowWidth === null || rowWidth <= 0) {
    return { showIcon: !dropIcon, fontSize };
  }

  const withoutIcon = { room: rowWidth - trailingRoom, layout: { showIcon: false } };

  return pickRung(
    widestWord(texts),
    dropIcon
      ? [withoutIcon]
      : [{ room: rowWidth - iconRoom - trailingRoom, layout: { showIcon: true } }, withoutIcon],
    { maxSize: fontSize, minSize, acceptAt: fontSize, fontScale, glyphWidthRatio }
  );
}

type TableColumnsOptions = {
  /** The header size the design asks for; used whenever every column's longest word fits. */
  maxSize: number;
  /** The smallest header size worth drawing; below it the columns shrink instead. */
  minSize: number;
  /** What a column spends beside its header word: its horizontal padding. */
  padding: number;
  /** No column is narrower than this, so a short header ("Reps") still holds a value. */
  minBasis: number;
  fontScale?: number;
  glyphWidthRatio?: number;
};

type TableColumns = {
  /** The size the header labels are drawn at. */
  fontSize: number;
  /** Each column's flex basis; give the header and every row the same ones, with `flexGrow: 1`. */
  bases: number[];
};

/**
 * Column widths for a table whose header words must stay whole ("Частичные" beside "Повторы").
 * Equal columns are as wide as the longest header word needs for EVERY column, which is what broke
 * a five-column sets table on a narrow phone; here each column is as wide as its own longest word
 * (at least `minBasis`) and the room left over is shared by `flexGrow`. When even that is wider
 * than the table, the header type shrinks a little, down to `minSize`. Before the table is
 * measured (`null`) the columns are sized for `maxSize`.
 */
export function layoutTableColumns(
  labels: string[],
  tableWidth: number | null,
  {
    maxSize,
    minSize,
    padding,
    minBasis,
    fontScale = 1,
    glyphWidthRatio = WORD_GLYPH_RATIO,
  }: TableColumnsOptions
): TableColumns {
  const words = labels.map(longestWord);
  const basesAt = (size: number) =>
    words.map((word) =>
      Math.max(minBasis, Math.ceil(word.length * size * glyphWidthRatio * fontScale) + padding)
    );
  const total = (bases: number[]) => bases.reduce((sum, basis) => sum + basis, 0);

  if (tableWidth === null || tableWidth <= 0) {
    return { fontSize: maxSize, bases: basesAt(maxSize) };
  }

  for (let size = maxSize; size > minSize; size -= 1) {
    const bases = basesAt(size);
    if (total(bases) <= tableWidth) {
      return { fontSize: size, bases };
    }
  }

  return { fontSize: minSize, bases: basesAt(minSize) };
}
