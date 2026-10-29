import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { ActivityHeatmap } from '@/components/charts/ActivityHeatmap';
import { SurfaceColorProvider } from '@/context/SurfaceColorContext';
import { type ActivityHeatmapSource, useActivityHeatmapDays } from '@/hooks/useActivityHeatmapDays';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import {
  NUTRITION_HEATMAP_MAX_VALUE,
  WORKOUT_HEATMAP_MAX_VALUE,
} from '@/utils/activityHeatmapData';

/**
 * Weeks drawn by each form. The full-width card fits 18 on a phone without scrolling; the half-width
 * one fits 12 of its smaller squares, which is why the two cards can show different spans.
 */
export const HOME_HEATMAP_WEEKS = { full: 18, compact: 12 } as const;

const MAX_VALUE: Record<ActivityHeatmapSource, number> = {
  workouts: WORKOUT_HEATMAP_MAX_VALUE,
  nutrition: NUTRITION_HEATMAP_MAX_VALUE,
};

type HomeHeatmapCardProps = {
  source: ActivityHeatmapSource;
  today: Date;
  compact: boolean;
};

function HomeHeatmapCard({ source, today, compact }: HomeHeatmapCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const weeks = compact ? HOME_HEATMAP_WEEKS.compact : HOME_HEATMAP_WEEKS.full;
  const days = useActivityHeatmapDays(source, today, weeks);

  // The count and its "none" wording differ per source; the keys are whole strings so the
  // translation checker can see them.
  const describeValue = (value: number) => {
    if (source === 'workouts') {
      return value === 0
        ? t('home.heatmaps.workouts.none')
        : t('home.heatmaps.workouts.count', { count: value });
    }

    return value === 0
      ? t('home.heatmaps.nutrition.none')
      : t('home.heatmaps.nutrition.count', { count: value });
  };

  return (
    <GenericCard fill={compact} containerStyle={compact ? { minWidth: 0 } : undefined}>
      <SurfaceColorProvider color={theme.colors.background.card}>
        <ActivityHeatmap
          className={compact ? 'p-3' : 'p-4'}
          title={t(
            source === 'workouts' ? 'home.heatmaps.workouts.title' : 'home.heatmaps.nutrition.title'
          )}
          subtitle={t('home.heatmaps.lastWeeks', { count: weeks })}
          days={days}
          endDate={today}
          weeks={weeks}
          maxValue={MAX_VALUE[source]}
          compact={compact}
          summary={t('home.heatmaps.tapHint')}
          describeDay={({ dateLabel, value }) => `${dateLabel}: ${describeValue(value)}`}
          // The legend alone is wider than a half-width card, so only the full form carries it.
          legend={
            compact ? undefined : { less: t('home.heatmaps.less'), more: t('home.heatmaps.more') }
          }
          scrollLabels={{
            earlier: t('home.heatmaps.earlierWeeks'),
            later: t('home.heatmaps.laterWeeks'),
          }}
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
 * Two heatmaps are either stacked at full width or share one row in the compact form. A single
 * heatmap is always full width: half a row with nothing beside it would only waste the space.
 */
export function HomeHeatmaps({ today }: HomeHeatmapsProps) {
  const { homeHeatmaps, homeHeatmapLayout } = useSettings();

  if (homeHeatmaps === 'none') {
    return null;
  }

  const sources: ActivityHeatmapSource[] =
    homeHeatmaps === 'both' ? ['workouts', 'nutrition'] : [homeHeatmaps];
  const sideBySide = sources.length === 2 && homeHeatmapLayout === 'side_by_side';

  return (
    <View className={`mx-4 mb-4 gap-3 ${sideBySide ? 'flex-row' : ''}`}>
      {sources.map((source) => (
        <HomeHeatmapCard key={source} source={source} today={today} compact={sideBySide} />
      ))}
    </View>
  );
}
