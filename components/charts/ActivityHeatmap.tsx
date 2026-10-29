import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
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

import {
  hidesContentToTheLeft,
  hidesContentToTheRight,
} from '@/components/workout/session/scrollOverflow';
import { MAX_CHROME_FONT_SCALE } from '@/constants/fontScale';
import { useChartTooltip } from '@/context/ChartTooltipContext';
import { useSurfaceColor } from '@/context/SurfaceColorContext';
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
/** Width of the fade, and of the arrow button on it, that marks a hidden side of the grid. */
const EDGE_FADE_WIDTH = 48;
/** Share of the visible width one arrow press scrolls, so the last column stays in view. */
const PAGE_SHARE = 0.75;

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
  /** Screen-reader names for the arrows that appear when weeks are hidden to either side. */
  scrollLabels?: { earlier: string; later: string };
  /** Shown under the grid while no day is selected. */
  summary?: string;
  className?: string;
};

/** Gradient into the card surface along one edge, marking weeks hidden past it. */
function EdgeFade({ side, surface }: { side: 'left' | 'right'; surface: string }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={side === 'left' ? [surface, 'transparent'] : ['transparent', surface]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ position: 'absolute', top: 0, bottom: 0, [side]: 0, width: EDGE_FADE_WIDTH }}
    />
  );
}

/**
 * The arrow on a faded edge. A phone swipes; a mouse has no horizontal wheel, so on web this is
 * the only way to the hidden weeks, and on touch it doubles as the "this scrolls" cue.
 */
function EdgeArrow({
  side,
  top,
  height,
  color,
  iconSize,
  label,
  onPress,
}: {
  side: 'left' | 'right';
  top: number;
  height: number;
  color: string;
  iconSize: number;
  label?: string;
  onPress: () => void;
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={{ top: 8, bottom: 8 }}
      onPress={onPress}
      style={{
        position: 'absolute',
        top,
        height,
        [side]: 0,
        width: EDGE_FADE_WIDTH * 0.7,
        alignItems: side === 'left' ? 'flex-start' : 'flex-end',
        justifyContent: 'center',
      }}
    >
      <Icon size={iconSize} color={color} />
    </Pressable>
  );
}

/**
 * A GitHub-style contribution grid: one column per week, one row per weekday, the darkest
 * squares being the busiest days.
 *
 * Plain views, so one file serves Android, iOS and web (no `.web.tsx`, no Skia). Squares shrink to
 * fit the card down to a readable minimum and then scroll sideways, opening on the latest week.
 * Weeks hidden past either edge fade into the card surface (`useSurfaceColor`) behind an arrow
 * that scrolls them into view.
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
  scrollLabels,
  summary,
  className,
}: ActivityHeatmapProps) {
  const theme = useTheme();
  const surface = useSurfaceColor();
  const { i18n } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const chartId = useId();
  const { registerChart, unregisterChart, notifyChartActive } = useChartTooltip();
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [offsetX, setOffsetX] = useState(0);

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
  const gridHeight = 7 * cell + 6 * GAP;
  const gridTop = MONTH_ROW_HEIGHT + MONTH_ROW_GAP;
  const hiddenLeft = hidesContentToTheLeft(offsetX);
  const hiddenRight = hidesContentToTheRight(viewportWidth, gridWidth, offsetX);
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

  // A grid wider than the card opens on today, the end that matters. `scrollToEnd` does not
  // always report back as a scroll, so the offset it lands on is recorded here directly.
  const scrollToLatest = useCallback(
    (contentWidth: number) => {
      scrollRef.current?.scrollToEnd({ animated: false });
      setOffsetX(Math.max(0, contentWidth - viewportWidth));
    },
    [viewportWidth]
  );

  const scrollByPage = (direction: -1 | 1) => {
    scrollRef.current?.scrollTo({
      x: Math.max(0, offsetX + direction * viewportWidth * PAGE_SHARE),
      animated: true,
    });
  };

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

        <View style={{ flex: 1 }}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onContentSizeChange={scrollToLatest}
            onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
            onScroll={(event) => setOffsetX(event.nativeEvent.contentOffset.x)}
            scrollEventThrottle={32}
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
          {hiddenLeft ? <EdgeFade side="left" surface={surface} /> : null}
          {hiddenLeft ? (
            <EdgeArrow
              side="left"
              top={gridTop}
              height={gridHeight}
              color={theme.colors.text.primary}
              iconSize={theme.iconSize.sm}
              label={scrollLabels?.earlier}
              onPress={() => scrollByPage(-1)}
            />
          ) : null}
          {hiddenRight ? <EdgeFade side="right" surface={surface} /> : null}
          {hiddenRight ? (
            <EdgeArrow
              side="right"
              top={gridTop}
              height={gridHeight}
              color={theme.colors.text.primary}
              iconSize={theme.iconSize.sm}
              label={scrollLabels?.later}
              onPress={() => scrollByPage(1)}
            />
          ) : null}
        </View>
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
