import type { LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Text, View } from 'react-native';

import { ACTIVITY_LEVEL_OPACITY } from '@/components/charts/ActivityHeatmap';
import { MAX_CHROME_FONT_SCALE } from '@/constants/fontScale';
import { useChartTooltip } from '@/context/ChartTooltipContext';
import { useTheme } from '@/hooks/useTheme';
import {
  type ActivityHeatmapDay,
  type ActivityHeatmapLevel,
  buildActivityStrip,
} from '@/utils/activityHeatmap';

const CELL_HEIGHT = 20;
const CELL_GAP = 2;
const LABEL_ICON_WIDTH = 16;

export type ActivityStripRow = {
  key: string;
  /** Names the row for screen readers; the row itself shows only `icon`. */
  label: string;
  icon: LucideIcon;
  days: ActivityHeatmapDay[];
  /** The day value that earns the darkest step. Defaults to the busiest day shown. */
  maxValue?: number;
  /** Says what a day's number counts ("3 workouts"). */
  describeValue: (value: number) => string;
};

export type ActivityHeatmapStripProps = {
  rows: ActivityStripRow[];
  /** Last day shown. Defaults to today. */
  endDate?: Date;
  /** Days drawn per row, ending on `endDate`. */
  dayCount: number;
  /** The header while no day is selected, e.g. "Last 30 days". */
  title: string;
  className?: string;
};

/**
 * The heatmap squeezed to a few rows: one run of cells per source, the last `dayCount` days, oldest
 * to newest, each cell sharing the width equally. A 7-row calendar needs most of a screen to show
 * ~4 months; this shows a month in a row per source, and drops the legend, the month and weekday
 * labels and the scrolling, none of which a single short run needs.
 *
 * Tapping a cell (hovering, on web) reads out that day in the header, where the title was, so the
 * card never changes height. Shares `buildActivityStrip`'s levels with the grid, so a day is the
 * same shade in both forms. All strings arrive translated; the date comes from `Intl`.
 */
export function ActivityHeatmapStrip({
  rows,
  endDate,
  dayCount,
  title,
  className,
}: ActivityHeatmapStripProps) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const chartId = useId();
  const { registerChart, unregisterChart, notifyChartActive } = useChartTooltip();
  const [selected, setSelected] = useState<{ rowKey: string; iso: string } | null>(null);

  useEffect(() => {
    registerChart(chartId, () => setSelected(null));

    return () => unregisterChart(chartId);
  }, [chartId, registerChart, unregisterChart]);

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }),
    [locale]
  );

  const models = useMemo(
    () =>
      rows.map((row) => ({
        row,
        ...buildActivityStrip({ days: row.days, endDate, dayCount, maxValue: row.maxValue }),
      })),
    [rows, endDate, dayCount]
  );

  const select = useCallback(
    (rowKey: string, iso: string) => {
      notifyChartActive(chartId);
      // On touch a second tap on the same cell clears it; on web it is the hover that selects, and
      // the click that follows must not undo that.
      setSelected((current) =>
        current?.rowKey === rowKey && current.iso === iso && Platform.OS !== 'web'
          ? null
          : { rowKey, iso }
      );
    },
    [chartId, notifyChartActive]
  );

  const describe = (date: Date, value: number, describeValue: (value: number) => string) =>
    `${dateFormat.format(date)}: ${describeValue(value)}`;

  let readout: string | null = null;
  for (const { row, cells } of models) {
    const cell = selected?.rowKey === row.key ? cells.find((c) => c.iso === selected.iso) : null;
    if (cell) {
      readout = describe(cell.date, cell.value, row.describeValue);
    }
  }

  return (
    <View className={className}>
      {/* A fixed-height header: the title gives way to the readout, so selecting never shifts the rows. */}
      <View className="mb-2 min-h-[16px] justify-center">
        <Text
          accessibilityRole="header"
          className={
            readout != null
              ? 'text-xs font-medium tabular-nums text-text-primary'
              : 'text-xs font-medium text-text-tertiary'
          }
          maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
          numberOfLines={1}
        >
          {readout ?? title}
        </Text>
      </View>

      <View style={{ gap: 6 }}>
        {models.map(({ row, cells }) => {
          const Icon = row.icon;

          return (
            <View key={row.key} className="flex-row items-center" style={{ gap: 8 }}>
              <View accessibilityLabel={row.label} accessible style={{ width: LABEL_ICON_WIDTH }}>
                <Icon size={LABEL_ICON_WIDTH} color={theme.colors.text.tertiary} />
              </View>
              <View className="flex-1 flex-row" style={{ gap: CELL_GAP }}>
                {cells.map((cell) => {
                  const isSelected = selected?.rowKey === row.key && selected.iso === cell.iso;
                  const level: ActivityHeatmapLevel = cell.level;

                  return (
                    <Pressable
                      key={cell.iso}
                      accessibilityLabel={describe(cell.date, cell.value, row.describeValue)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      hitSlop={{ top: 6, bottom: 6 }}
                      onHoverIn={() => select(row.key, cell.iso)}
                      onHoverOut={() =>
                        setSelected((current) =>
                          current?.rowKey === row.key && current.iso === cell.iso ? null : current
                        )
                      }
                      onPress={() => select(row.key, cell.iso)}
                      style={{
                        flex: 1,
                        height: CELL_HEIGHT,
                        borderRadius: theme.borderRadius.tag,
                        backgroundColor:
                          level === 0 ? theme.colors.background.ink10 : theme.colors.accent.primary,
                        opacity: ACTIVITY_LEVEL_OPACITY[level],
                        borderWidth: isSelected ? 2 : 0,
                        borderColor: theme.colors.text.primary,
                      }}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
