import { Dumbbell, Utensils } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { ActivityDayGrid } from '@/components/charts/ActivityDayGrid';
import { ActivityHeatmap } from '@/components/charts/ActivityHeatmap';
import {
  ActivityHeatmapStrip,
  type ActivityStripRow,
} from '@/components/charts/ActivityHeatmapStrip';
import { SurfaceColorProvider } from '@/context/SurfaceColorContext';
import { type ActivityHeatmapSource, useActivityHeatmapDays } from '@/hooks/useActivityHeatmapDays';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import {
  NUTRITION_HEATMAP_MAX_VALUE,
  WORKOUT_HEATMAP_MAX_VALUE,
} from '@/utils/activityHeatmapData';

/** Weeks drawn by the full-width card, which fits 18 on a phone without scrolling. */
export const HOME_HEATMAP_FULL_WEEKS = 18;

/**
 * Days drawn by the two compact forms: each row of the strip, and each half-width card of the
 * side-by-side layout, which wraps them into `HOME_HEATMAP_DAY_GRID_COLUMNS` squares per row.
 */
export const HOME_HEATMAP_STRIP_DAYS = 30;
export const HOME_HEATMAP_DAY_GRID_COLUMNS = 10;
/** Weeks a query reaches back to cover `HOME_HEATMAP_STRIP_DAYS`, plus the hook's spare week. */
const STRIP_QUERY_WEEKS = Math.ceil(HOME_HEATMAP_STRIP_DAYS / 7);

const MAX_VALUE: Record<ActivityHeatmapSource, number> = {
  workouts: WORKOUT_HEATMAP_MAX_VALUE,
  nutrition: NUTRITION_HEATMAP_MAX_VALUE,
};

const SOURCE_ICON = { workouts: Dumbbell, nutrition: Utensils } as const;

/** What a day's number counts, per source. Whole keys, so the translation checker can see them. */
function useDescribeValue(source: ActivityHeatmapSource) {
  const { t } = useTranslation();

  return (value: number) => {
    if (source === 'workouts') {
      return value === 0
        ? t('home.heatmaps.workouts.none')
        : t('home.heatmaps.workouts.count', { count: value });
    }

    return value === 0
      ? t('home.heatmaps.nutrition.none')
      : t('home.heatmaps.nutrition.count', { count: value });
  };
}

type HomeHeatmapCardProps = {
  source: ActivityHeatmapSource;
  today: Date;
};

function HomeHeatmapCard({ source, today }: HomeHeatmapCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const days = useActivityHeatmapDays(source, today, HOME_HEATMAP_FULL_WEEKS);

  const describeValue = useDescribeValue(source);

  return (
    <GenericCard>
      <SurfaceColorProvider color={theme.colors.background.card}>
        <ActivityHeatmap
          className="p-4"
          title={t(
            source === 'workouts' ? 'home.heatmaps.workouts.title' : 'home.heatmaps.nutrition.title'
          )}
          subtitle={t('home.heatmaps.lastWeeks', { count: HOME_HEATMAP_FULL_WEEKS })}
          days={days}
          endDate={today}
          weeks={HOME_HEATMAP_FULL_WEEKS}
          maxValue={MAX_VALUE[source]}
          summary={t('home.heatmaps.tapHint')}
          describeDay={({ dateLabel, value }) => `${dateLabel}: ${describeValue(value)}`}
          legend={{ less: t('home.heatmaps.less'), more: t('home.heatmaps.more') }}
          scrollLabels={{
            earlier: t('home.heatmaps.earlierWeeks'),
            later: t('home.heatmaps.laterWeeks'),
          }}
        />
      </SurfaceColorProvider>
    </GenericCard>
  );
}

/** One half of the side-by-side layout: the title over the last 30 days, three short rows. */
function HomeHeatmapDayGridCard({ source, today }: HomeHeatmapCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const days = useActivityHeatmapDays(source, today, STRIP_QUERY_WEEKS);
  const describeValue = useDescribeValue(source);

  return (
    <GenericCard fill containerStyle={{ minWidth: 0 }}>
      <SurfaceColorProvider color={theme.colors.background.card}>
        <ActivityDayGrid
          className="p-3"
          title={t(
            source === 'workouts' ? 'home.heatmaps.workouts.title' : 'home.heatmaps.nutrition.title'
          )}
          days={days}
          endDate={today}
          dayCount={HOME_HEATMAP_STRIP_DAYS}
          columns={HOME_HEATMAP_DAY_GRID_COLUMNS}
          maxValue={MAX_VALUE[source]}
          describeValue={describeValue}
        />
      </SurfaceColorProvider>
    </GenericCard>
  );
}

type HomeHeatmapStripCardProps = {
  sources: ActivityHeatmapSource[];
  today: Date;
};

/**
 * One card for every selected heatmap, a thin row each. A source that is not selected is passed
 * `enabled: false`, so it costs no query.
 */
function HomeHeatmapStripCard({ sources, today }: HomeHeatmapStripCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const workoutDays = useActivityHeatmapDays('workouts', today, STRIP_QUERY_WEEKS, {
    enabled: sources.includes('workouts'),
  });
  const nutritionDays = useActivityHeatmapDays('nutrition', today, STRIP_QUERY_WEEKS, {
    enabled: sources.includes('nutrition'),
  });
  const describeWorkouts = useDescribeValue('workouts');
  const describeNutrition = useDescribeValue('nutrition');

  const rows: ActivityStripRow[] = sources.map((source) =>
    source === 'workouts'
      ? {
          key: source,
          label: t('home.heatmaps.workouts.title'),
          icon: SOURCE_ICON.workouts,
          days: workoutDays,
          maxValue: MAX_VALUE.workouts,
          describeValue: describeWorkouts,
        }
      : {
          key: source,
          label: t('home.heatmaps.nutrition.title'),
          icon: SOURCE_ICON.nutrition,
          days: nutritionDays,
          maxValue: MAX_VALUE.nutrition,
          describeValue: describeNutrition,
        }
  );

  return (
    <GenericCard>
      <SurfaceColorProvider color={theme.colors.background.card}>
        <ActivityHeatmapStrip
          className="p-3"
          rows={rows}
          endDate={today}
          dayCount={HOME_HEATMAP_STRIP_DAYS}
          title={t('home.heatmaps.lastDays', { count: HOME_HEATMAP_STRIP_DAYS })}
        />
      </SurfaceColorProvider>
    </GenericCard>
  );
}

type HomeHeatmapsProps = {
  /** The day the grids end on; the screen already tracks it across midnight. */
  today: Date;
};

/**
 * The home screen's activity heatmaps, as the user configured them (`homeHeatmaps`,
 * `homeHeatmapLayout`). Self-gating: with the setting off it renders nothing and subscribes to
 * nothing, so the home screen pays for these only when they are shown.
 *
 * Two heatmaps are either stacked at full width or share one row as two small cards (the last 30 days, title only). The
 * `compact` layout instead puts every selected heatmap in ONE short card, a thin 30-day row each. A single
 * heatmap is always full width: half a row with nothing beside it would only waste the space.
 */
export function HomeHeatmaps({ today }: HomeHeatmapsProps) {
  const { homeHeatmaps, homeHeatmapLayout } = useSettings();

  if (homeHeatmaps === 'none') {
    return null;
  }

  const sources: ActivityHeatmapSource[] =
    homeHeatmaps === 'both' ? ['workouts', 'nutrition'] : [homeHeatmaps];

  if (homeHeatmapLayout === 'compact') {
    return (
      <View className="mx-4 mb-4">
        <HomeHeatmapStripCard sources={sources} today={today} />
      </View>
    );
  }

  const sideBySide = sources.length === 2 && homeHeatmapLayout === 'side_by_side';

  return (
    <View className={`mx-4 mb-4 gap-3 ${sideBySide ? 'flex-row' : ''}`}>
      {sources.map((source) =>
        sideBySide ? (
          <HomeHeatmapDayGridCard key={source} source={source} today={today} />
        ) : (
          <HomeHeatmapCard key={source} source={source} today={today} />
        )
      )}
    </View>
  );
}
