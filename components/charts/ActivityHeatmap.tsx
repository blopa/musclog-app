import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  Text,
  View,
} from 'react-native';

import { MAX_CHROME_FONT_SCALE } from '@/constants/fontScale';
import { useChartTooltip } from '@/context/ChartTooltipContext';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import {
  ACTIVITY_HEATMAP_LEVELS,
  type ActivityHeatmapDay,
  type ActivityHeatmapLevel,
  buildActivityHeatmap,
} from '@/utils/activityHeatmap';

/** Opacity of the accent over the card for levels 1-4; level 0 is the neutral empty cell. */
const LEVEL_OPACITY: Record<ActivityHeatmapLevel, number> = {
  0: 1,
  1: 0.32,
  2: 0.52,
  3: 0.76,
  4: 1,
};

const GAP = 3;
const MIN_CELL = 12;
const MAX_CELL = 18;
const WEEKDAY_COLUMN_WIDTH = 30;
const WEEKDAY_COLUMN_GAP = 8;
const MONTH_ROW_HEIGHT = 16;
const MONTH_ROW_GAP = 6;
const LEGEND_SWATCH = 12;

export type ActivityHeatmapDayInfo = {
  date: Date;
  /** The date already formatted for the active language. */
  dateLabel: string;
  value: number;
};

export type ActivityHeatmapProps = {
  /** One entry per day with activity; days left out count as 0. */
  days: ActivityHeatmapDay[];
  title?: string;
  subtitle?: string;
  /** Last day shown. Defaults to today. */
  endDate?: Date;
  /** Weeks to draw (1-53, default 26). Wider than the card scrolls, showing the latest weeks. */
  weeks?: number;
  /** 0 = Sunday (default, like the date picker), 1 = Monday. */
  weekStartsOn?: 0 | 1;
  /** The day value that earns the darkest step. Defaults to the busiest day shown. */
  maxValue?: number;
  /** Colour of the filled steps. Defaults to the theme's primary accent. */
  accentColor?: string;
  /**
   * Text for the selected day and for each cell's screen-reader label. The default is the date and
   * the bare number; pass this to say what the number counts ("3 workouts").
   */
  describeDay?: (info: ActivityHeatmapDayInfo) => string;
  /** Ends of the legend. Omit to hide the legend. */
  legend?: { less: string; more: string };
  /** Shown under the grid while no day is selected. */
  summary?: string;
  className?: string;
};

/**
 * A GitHub-style contribution grid: one column per week, one row per weekday, the darkest
 * squares being the busiest days.
 *
 * Plain views, so one file serves Android, iOS and web (no `.web.tsx`, no Skia). Squares shrink to
 * fit the card down to a readable minimum and then scroll sideways, opening on the latest week.
 * Tapping a square (hovering, on web) reads out that day beneath the grid. Every string arrives
 * from the caller already translated; month and weekday names come from `Intl` for the app's
 * language.
 */
export function ActivityHeatmap({
  days,
  title,
  subtitle,
  endDate,
  weeks = 26,
  weekStartsOn = 0,
  maxValue,
  accentColor,
  describeDay,
  legend,
  summary,
  className,
}: ActivityHeatmapProps) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const chartId = useId();
  const { registerChart, unregisterChart, notifyChartActive } = useChartTooltip();
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    registerChart(chartId, () => setSelectedIso(null));

    return () => unregisterChart(chartId);
  }, [chartId, registerChart, unregisterChart]);

  const model = useMemo(
    () => buildActivityHeatmap({ days, endDate, weeks, weekStartsOn, maxValue }),
    [days, endDate, weeks, weekStartsOn, maxValue]
  );

  const monthFormat = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short' }), [locale]);
  const weekdayFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    [locale]
  );
  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [locale]
  );

  const describe = useCallback(
    (date: Date, value: number) => {
      const dateLabel = dateFormat.format(date);

      return describeDay
        ? describeDay({ date, dateLabel, value })
        : `${dateLabel}: ${formatInteger(value)}`;
    },
    [dateFormat, describeDay, formatInteger]
  );

  const columnCount = model.columns.length;
  const available = Math.max(0, width - WEEKDAY_COLUMN_WIDTH - WEEKDAY_COLUMN_GAP);
  const fitted = Math.floor((available - GAP * (columnCount - 1)) / columnCount);
  const cell = width === 0 ? MIN_CELL : Math.min(MAX_CELL, Math.max(MIN_CELL, fitted));
  const step = cell + GAP;
  const gridWidth = columnCount * cell + (columnCount - 1) * GAP;
  const accent = accentColor ?? theme.colors.accent.primary;

  const colorFor = (level: ActivityHeatmapLevel) =>
    level === 0 ? theme.colors.background.ink10 : accent;

  const selected = useMemo(() => {
    for (const column of model.columns) {
      for (const day of column) {
        if (day?.iso === selectedIso) {
          return day;
        }
      }
    }

    return null;
  }, [model.columns, selectedIso]);

  // A grid wider than the card opens on today, the end that matters.
  const scrollToLatest = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, []);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(Math.round(event.nativeEvent.layout.width));
  }, []);

  const select = (iso: string) => {
    notifyChartActive(chartId);
    // On touch a second tap on the same square clears it; on web it is the hover that selects,
    // and the click that follows must not undo that.
    setSelectedIso((current) => (current === iso && Platform.OS !== 'web' ? null : iso));
  };

  const readout = selected ? describe(selected.date, selected.value) : summary;

  return (
    <View className={className} onLayout={handleLayout}>
      {title != null || subtitle != null ? (
        <View className="mb-4">
          {title != null ? (
            <Text accessibilityRole="header" className="text-base font-semibold text-text-primary">
              {title}
            </Text>
          ) : null}
          {subtitle != null ? (
            <Text className="mt-0.5 text-xs text-text-tertiary">{subtitle}</Text>
          ) : null}
        </View>
      ) : null}

      <View className="flex-row" style={{ gap: WEEKDAY_COLUMN_GAP }}>
        {/* Weekday labels stay put while the weeks scroll. Every other row, as there is no room for all seven. */}
        <View style={{ width: WEEKDAY_COLUMN_WIDTH, paddingTop: MONTH_ROW_HEIGHT + MONTH_ROW_GAP }}>
          {model.weekdays.map((date, row) => (
            <View
              key={row}
              style={{ height: cell, marginBottom: row < 6 ? GAP : 0, justifyContent: 'center' }}
            >
              {row % 2 === 1 ? (
                <Text
                  className="text-[10px] font-medium text-text-tertiary"
                  maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
                  numberOfLines={1}
                >
                  {weekdayFormat.format(date)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={scrollToLatest}
          style={{ flex: 1 }}
        >
          <View style={{ width: gridWidth }}>
            <View style={{ height: MONTH_ROW_HEIGHT, marginBottom: MONTH_ROW_GAP }}>
              {model.monthLabels.map((label) => (
                <Text
                  key={label.column}
                  className="text-[10px] font-medium text-text-tertiary"
                  maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
                  numberOfLines={1}
                  style={{ position: 'absolute', left: label.column * step, width: step * 3 }}
                >
                  {monthFormat.format(label.date)}
                </Text>
              ))}
            </View>

            <View className="flex-row" style={{ gap: GAP }}>
              {model.columns.map((column, columnIndex) => (
                <View key={columnIndex} style={{ gap: GAP }}>
                  {column.map((day, row) => {
                    if (!day) {
                      return null;
                    }

                    const isSelected = day.iso === selectedIso;

                    return (
                      <Pressable
                        key={row}
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
                          backgroundColor: colorFor(day.level),
                          opacity: LEVEL_OPACITY[day.level],
                          borderWidth: isSelected ? 2 : 0,
                          borderColor: theme.colors.text.primary,
                        }}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      <View className="mt-3 min-h-[18px] justify-center">
        {readout != null ? (
          <Text
            className="text-xs font-medium tabular-nums text-text-secondary"
            maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
            numberOfLines={1}
          >
            {readout}
          </Text>
        ) : null}
      </View>

      {legend ? (
        <View className="mt-2 flex-row items-center justify-end gap-1.5">
          <Text
            className="text-[10px] font-medium text-text-tertiary"
            maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
          >
            {legend.less}
          </Text>
          {Array.from({ length: ACTIVITY_HEATMAP_LEVELS + 1 }, (_, level) => {
            const stepLevel = level as ActivityHeatmapLevel;

            return (
              <View
                key={level}
                style={{
                  width: LEGEND_SWATCH,
                  height: LEGEND_SWATCH,
                  borderRadius: theme.borderRadius.tag,
                  backgroundColor: colorFor(stepLevel),
                  opacity: LEVEL_OPACITY[stepLevel],
                }}
              />
            );
          })}
          <Text
            className="text-[10px] font-medium text-text-tertiary"
            maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
          >
            {legend.more}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
