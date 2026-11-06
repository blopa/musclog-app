import { Text, View } from 'react-native';

import { MAX_CHROME_FONT_SCALE } from '@/constants/fontScale';
import type { PosterGround } from '@/constants/loggyPalette';
import { ACTIVITY_LEVEL_OPACITY } from '@/utils/activityHeatmap';
import type { YearCalendarMonth, YearWeekCell } from '@/utils/yearInReview/yearCharts';

const MONTHS_PER_ROW = 3;
const CELLS_PER_ROW = 7;
const CELL_GAP = 2;
const MONTH_GAP = 12;
const MONTH_ROWS = 4;
/** A month needs up to six week rows, plus its name above them. */
const WEEK_ROWS = 6;
const MONTH_LABEL_HEIGHT = 24;

type CalendarProps = {
  months: YearCalendarMonth[];
  monthLabels: string[];
  width: number;
  /** The grid must fit this too: on a short phone height runs out before width does. */
  maxHeight: number;
  ground: PosterGround;
  /** The colour of a trained day. */
  markColor: string;
};

/** The whole year on one poster: twelve month grids, three to a row, no scrolling. */
export function YearCalendar({
  months,
  monthLabels,
  width,
  maxHeight,
  ground,
  markColor,
}: CalendarProps) {
  const monthWidth = (width - MONTH_GAP * (MONTHS_PER_ROW - 1)) / MONTHS_PER_ROW;
  const monthHeight = (maxHeight - MONTH_GAP * (MONTH_ROWS - 1)) / MONTH_ROWS;
  const cell = Math.floor(
    Math.min(
      (monthWidth - CELL_GAP * (CELLS_PER_ROW - 1)) / CELLS_PER_ROW,
      (monthHeight - MONTH_LABEL_HEIGHT - CELL_GAP * (WEEK_ROWS - 1)) / WEEK_ROWS
    )
  );
  const gridWidth = cell * CELLS_PER_ROW + CELL_GAP * (CELLS_PER_ROW - 1);

  const renderMonth = ({ month, leadingBlanks, levels }: YearCalendarMonth) => (
    // The column's width, not the grid's: a short screen shrinks the grid but not the month's name.
    <View key={month} style={{ width: monthWidth }}>
      <Text
        className="mb-1 text-sm font-semibold"
        maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
        numberOfLines={1}
        style={{ color: ground.ink }}
      >
        {monthLabels[month]}
      </Text>
      <View className="flex-row flex-wrap" style={{ gap: CELL_GAP, width: gridWidth }}>
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <View key={`blank-${index}`} style={{ height: cell, width: cell }} />
        ))}
        {levels.map((level, index) => (
          <View
            key={index}
            className="rounded-tag"
            style={{
              backgroundColor: level === 0 ? ground.track : markColor,
              height: cell,
              opacity: ACTIVITY_LEVEL_OPACITY[level],
              width: cell,
            }}
          />
        ))}
      </View>
    </View>
  );

  // Explicit rows: a wrapping row would fit more months across once a short screen shrinks them.
  return (
    <View style={{ gap: MONTH_GAP, width }}>
      {Array.from({ length: MONTH_ROWS }, (_, row) => (
        <View key={row} className="flex-row justify-between">
          {months.slice(row * MONTHS_PER_ROW, (row + 1) * MONTHS_PER_ROW).map(renderMonth)}
        </View>
      ))}
    </View>
  );
}

type WeekStripProps = {
  cells: YearWeekCell[];
  height: number;
  ground: PosterGround;
};

/** Every week of the year as a bar, with the longest run standing out. */
export function YearWeekStrip({ cells, height, ground }: WeekStripProps) {
  const colorOf: Record<YearWeekCell, string> = {
    empty: ground.track,
    trained: ground.mark,
    longestRun: ground.highlight,
  };

  return (
    <View className="flex-row" style={{ gap: CELL_GAP, height }}>
      {cells.map((cell, index) => (
        <View
          key={index}
          className="flex-1 rounded-tag"
          style={{ backgroundColor: colorOf[cell] }}
        />
      ))}
    </View>
  );
}

type MonthBarsProps = {
  counts: number[];
  /** Narrow month names, January first. */
  labels: string[];
  highlight: number;
  height: number;
  ground: PosterGround;
};

/** Sessions per month, the busiest one solid. */
export function YearMonthBars({ counts, labels, highlight, height, ground }: MonthBarsProps) {
  const max = Math.max(...counts, 1);

  return (
    <View className="flex-row items-end gap-1">
      {counts.map((count, month) => (
        <View key={month} className="flex-1 items-center gap-1">
          <View className="w-full justify-end" style={{ height }}>
            <View
              className="w-full rounded-tag"
              style={{
                backgroundColor: month === highlight ? ground.highlight : ground.mark,
                // An empty month keeps a sliver, so the row still reads as twelve months.
                height: count > 0 ? Math.max(6, (count / max) * height) : 3,
                opacity: count > 0 ? 1 : 0.4,
              }}
            />
          </View>
          <Text
            className="text-sm font-semibold"
            maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
            style={{ color: ground.ink }}
          >
            {labels[month]}
          </Text>
        </View>
      ))}
    </View>
  );
}

type ShareBarProps = {
  label: string;
  value: string;
  /** 0-1, the bar's share of its track. */
  share: number;
  highlighted: boolean;
  ground: PosterGround;
  /** A shorter row, for a list of four. */
  compact?: boolean;
};

/** A labelled horizontal bar: a time of day, a most-trained exercise. */
export function YearShareBar({
  label,
  value,
  share,
  highlighted,
  ground,
  compact = false,
}: ShareBarProps) {
  const textSize = compact ? 'text-base' : 'text-lg';

  return (
    <View className={compact ? 'gap-1' : 'gap-1.5'}>
      <View className="flex-row items-baseline justify-between gap-3">
        <Text
          className={`min-w-0 flex-1 font-semibold ${textSize}`}
          maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
          numberOfLines={2}
          style={{ color: ground.ink }}
        >
          {label}
        </Text>
        <Text
          className={`font-semibold tabular-nums ${textSize}`}
          maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
          style={{ color: ground.ink }}
        >
          {value}
        </Text>
      </View>
      <View className="h-2.5 overflow-hidden rounded-tag" style={{ backgroundColor: ground.track }}>
        <View
          className="h-full rounded-tag"
          style={{
            backgroundColor: highlighted ? ground.highlight : ground.mark,
            width: `${Math.round(share * 100)}%`,
          }}
        />
      </View>
    </View>
  );
}
