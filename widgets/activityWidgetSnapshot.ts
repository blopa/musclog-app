import { ACTIVITY_HEATMAP_SOURCES, type ActivityHeatmapSource } from '@/constants/settings';
import type { ActivityHeatmapDay } from '@/utils/activityHeatmap';
import { ACTIVITY_LEVEL_OPACITY, buildActivityStrip } from '@/utils/activityHeatmap';
import { ACTIVITY_SOURCES } from '@/utils/activityHeatmapData';

import { INITIAL_WIDGET_PALETTE, widgetColorWithAlpha, type WidgetPalette } from './widgetSnapshot';

/** `stale` shows only `refreshMessage`: nothing read yet, or the widget was reset. */
export type ActivityWidgetState = 'ready' | 'stale';

export type ActivityWidgetRow = {
  key: ActivityHeatmapSource;
  label: string;
  /** One level (0-4, an index into `levelColors`) per day, oldest first, ending today. */
  levels: number[];
};

export type ActivityWidgetSnapshot = {
  state: ActivityWidgetState;
  title: string;
  rows: ActivityWidgetRow[];
  /** `#rrggbbaa` for levels 0-4, composed here because the widget runtimes have no opacity. */
  levelColors: string[];
  palette: WidgetPalette;
  refreshMessage: string;
  url: string;
};

/** The days drawn per row: the same last 30 as the compact Home heatmap. */
export const ACTIVITY_WIDGET_DAYS = 30;

/** Opens Home, where the heatmaps are. */
export const ACTIVITY_WIDGET_URL = 'com.werules.logger://?action=open-home';

export const INITIAL_ACTIVITY_SNAPSHOT: ActivityWidgetSnapshot = {
  state: 'stale',
  title: 'Musclog',
  rows: [],
  levelColors: [],
  palette: INITIAL_WIDGET_PALETTE,
  refreshMessage: 'Open Musclog to refresh',
  url: ACTIVITY_WIDGET_URL,
};

/**
 * The five square colors. Level 0 is the palette's track, the others are the accent at the same
 * opacity the Home heatmap gives them over its card, so a day is the same shade in both.
 */
export function activityLevelColors(palette: WidgetPalette): string[] {
  return ([0, 1, 2, 3, 4] as const).map((level) =>
    level === 0
      ? palette.track
      : widgetColorWithAlpha(palette.accent, ACTIVITY_LEVEL_OPACITY[level])
  );
}

export function buildActivityWidgetSnapshot({
  date,
  days,
  palette,
  translate,
}: {
  date: Date;
  days: Record<ActivityHeatmapSource, ActivityHeatmapDay[]>;
  palette: WidgetPalette;
  translate: (key: string, options?: { count: number }) => string;
}): ActivityWidgetSnapshot {
  return {
    state: 'ready',
    title: translate('home.heatmaps.lastDays', { count: ACTIVITY_WIDGET_DAYS }),
    rows: ACTIVITY_HEATMAP_SOURCES.map((key) => ({
      key,
      label: translate(ACTIVITY_SOURCES[key].titleKey),
      levels: buildActivityStrip({
        days: days[key],
        endDate: date,
        dayCount: ACTIVITY_WIDGET_DAYS,
        maxValue: ACTIVITY_SOURCES[key].maxValue,
      }).cells.map((cell) => cell.level),
    })),
    levelColors: activityLevelColors(palette),
    palette,
    refreshMessage: translate('widgets.refresh'),
    url: ACTIVITY_WIDGET_URL,
  };
}

/**
 * What the home screen shows after midnight, until the app refreshes it: every row moves one day
 * along and the new day is empty, which is true at 00:00. Unlike the figures of the Nutrition
 * widget, the squares stay correct, so there is no need to fall back to a refresh prompt.
 */
export function expiredActivityWidgetSnapshot(
  snapshot: ActivityWidgetSnapshot
): ActivityWidgetSnapshot {
  if (snapshot.state !== 'ready') {
    return snapshot;
  }

  return {
    ...snapshot,
    rows: snapshot.rows.map((row) => ({ ...row, levels: [...row.levels.slice(1), 0] })),
  };
}
