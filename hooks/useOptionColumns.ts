import { useMeasuredWidth } from '@/hooks/useMeasuredWidth';
import { labelsFitEvenly, WORD_GLYPH_RATIO } from '@/utils/fitText';

type OptionColumnsOptions = {
  fontSize: number;
  /** What each card spends beside its label: padding, border, icon, dot and the gaps between. */
  chrome: number;
  /** The gap between the two columns. */
  gap: number;
};

/**
 * How many columns an option grid gets: two while the longest word of every label fits half the
 * grid beside its icon and radio dot, one when it does not (a Dutch "Uithoudingsvermogen", a
 * narrow phone, large text). Two cramped cards broke or overran their labels; a full-width card
 * always has room. Before the grid is measured it is two, which is what the first frame draws.
 */
export function useOptionColumns(
  labels: string[],
  { fontSize, chrome, gap }: OptionColumnsOptions
) {
  const { width: gridWidth, fontScale, onLayout: onGridLayout } = useMeasuredWidth();
  const twoColumns = labelsFitEvenly(labels, gridWidth, {
    fontSize,
    chrome,
    gap,
    columns: 2,
    fontScale,
    glyphWidthRatio: WORD_GLYPH_RATIO,
  });

  return { columns: twoColumns ? 2 : 1, onGridLayout };
}
