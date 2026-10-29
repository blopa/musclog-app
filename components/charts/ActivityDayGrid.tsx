import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, Platform, Pressable, Text, View } from 'react-native';

import { MAX_CHROME_FONT_SCALE } from '@/constants/fontScale';
import { useChartTooltip } from '@/context/ChartTooltipContext';
import { useTheme } from '@/hooks/useTheme';
import {
  ACTIVITY_LEVEL_OPACITY,
  type ActivityHeatmapDay,
  buildActivityStrip,
} from '@/utils/activityHeatmap';

const CELL_GAP = 3;
const MAX_CELL = 18;

export type ActivityDayGridProps = {
  days: ActivityHeatmapDay[];
  /** Last day shown. Defaults to today. */
  endDate?: Date;
  /** Days drawn, ending on `endDate`. */
  dayCount: number;
  /** Squares per row; the days wrap oldest to newest, left to right, top to bottom. */
  columns: number;
  /** The day value that earns the darkest step. Defaults to the busiest day shown. */
  maxValue?: number;
  /** Says what a day's number counts ("3 workouts"). */
  describeValue: (value: number) => string;
  /** The header while no day is selected. */
  title: string;
  className?: string;
};

/**
 * The heatmap for a half-width card: the last `dayCount` days as a few short rows of squares, with
 * no weekday structure, so a month takes about three rows instead of the seven a calendar needs.
 * Squares are sized to the measured width and capped, so the grid never scrolls.
 *
 * Tapping a square (hovering, on web) reads out that day in the header, where the title was, so the
 * card never changes height. Levels come from `buildActivityStrip`, the same as the other forms.
 * All strings arrive translated; the date comes from `Intl`.
 */
export function ActivityDayGrid({
  days,
  endDate,
  dayCount,
  columns,
  maxValue,
  describeValue,
  title,
  className,
}: ActivityDayGridProps) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const chartId = useId();
  const { registerChart, unregisterChart, notifyChartActive } = useChartTooltip();
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    registerChart(chartId, () => setSelectedIso(null));

    return () => unregisterChart(chartId);
  }, [chartId, registerChart, unregisterChart]);

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
    [locale]
  );

  const { cells } = useMemo(
    () => buildActivityStrip({ days, endDate, dayCount, maxValue }),
    [days, endDate, dayCount, maxValue]
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(Math.round(event.nativeEvent.layout.width));
  }, []);

  const select = (iso: string) => {
    notifyChartActive(chartId);
    // On touch a second tap on the same square clears it; on web it is the hover that selects, and
    // the click that follows must not undo that.
    setSelectedIso((current) => (current === iso && Platform.OS !== 'web' ? null : iso));
  };

  const describe = (date: Date, value: number) =>
    `${dateFormat.format(date)}: ${describeValue(value)}`;

  const selected = cells.find((cell) => cell.iso === selectedIso);
  const readout = selected ? describe(selected.date, selected.value) : null;
  const fitted = Math.floor((width - CELL_GAP * (columns - 1)) / columns);
  const cell = width === 0 ? 0 : Math.min(MAX_CELL, Math.max(6, fitted));

  return (
    <View className={className}>
      {/* A fixed-height header: the title gives way to the readout, so selecting never shifts the grid. */}
      <View className="mb-2 min-h-[20px] justify-center">
        <Text
          accessibilityRole="header"
          className={
            readout != null
              ? 'text-xs font-semibold tabular-nums text-text-primary'
              : 'text-base font-semibold text-text-primary'
          }
          maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
          numberOfLines={1}
        >
          {readout ?? title}
        </Text>
      </View>

      <View className="flex-row flex-wrap" onLayout={handleLayout} style={{ gap: CELL_GAP }}>
        {cell > 0
          ? cells.map((day) => {
              const isSelected = day.iso === selectedIso;

              return (
                <Pressable
                  key={day.iso}
                  accessibilityLabel={describe(day.date, day.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onHoverIn={() => select(day.iso)}
                  onHoverOut={() =>
                    setSelectedIso((current) => (current === day.iso ? null : current))
                  }
                  onPress={() => select(day.iso)}
                  style={{
                    width: cell,
                    height: cell,
                    borderRadius: theme.borderRadius.tag,
                    backgroundColor:
                      day.level === 0 ? theme.colors.background.ink10 : theme.colors.accent.primary,
                    opacity: ACTIVITY_LEVEL_OPACITY[day.level],
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: theme.colors.text.primary,
                  }}
                />
              );
            })
          : null}
      </View>
    </View>
  );
}
